import type { TowerState, SimEvent } from '../src/core/tower/sim-types';
import { flyingSpeed } from '../src/core/tower/flight';
import { speedCurve } from '../src/core/tower/speed-curve';
import { wobbleOffset } from '../src/core/tower/wobble';
import { BALANCE, DIFFICULTY } from '../src/data/tower/balance';
import { NO_TEAM, SIM_TEAMS, SIM_TEAM_LEVEL } from '../src/data/debug/sim-teams';
import { ZONE_RULES } from '../src/data/zones/zones';
import { intArg, scriptArgs } from './node-env';
import type { RunObserver } from './run-observer';
import {
  ANALYSIS_MAX_HEIGHT,
  mean,
  percentile,
  playRun,
  profileStreams,
  teamSlots,
} from './sim-runner';
import { applySets, setArg } from './what-if';

/**
 * Why runs end on the first layers (`npm run sim:first40`): the end height distribution, the
 * hazard per layer and the cause of every run end below `CAUSE_LIMIT`, per profile and team.
 *
 * `npm run sim:first40 -- [--runs=4000] [--profiles=novice,regular] [--teams=none,reliable]
 *   [--level=3] [--set=...]`; a team may carry its own level: `--teams=none,reliable,honey@1`.
 *
 * Causes of a run end (first match wins):
 * - `sneeze`: the tower sneezed (wobble at the maximum) and left too little of the top layer;
 * - `sway`: a drop miss that would have landed if the top layer had not swayed while the layer
 *   fell (the bot aims at the top where it is at the tap);
 * - `rush`: a miss on a rush layer that would have landed at the speed without the rush multiplier;
 * - `speed`: the missed layer was still at least `WIDE_LAYER` wide, so one big timing error lost it;
 * - `narrowing`: the missed layer had shrunk below `WIDE_LAYER` after inaccurate drops.
 * Every drop miss also reports whether it would have landed at the start speed of the first layer
 * (`BALANCE.speed.start`: 600 until session 7b, 540 since) and whether it was a showcase layer
 * (the side of departure does not change the bot's timing).
 */

/** Runs end below this height are split by cause; also the target of the share columns. */
const CAUSE_LIMIT = 40;
/** A layer this wide or wider counts as "still wide": the width a continue restores. */
const WIDE_LAYER = BALANCE.continues.restoreWidth;
const SHARE_BELOW = [20, 40, 80] as const;
const HISTOGRAM = [0, 10, 20, 30, 40, 60, 80, 120, 200] as const;
const HAZARD_BANDS = [1, 6, 11, 16, 21, 26, 31, 36, 41] as const;
const WIDTH_AT = [10, 20, 30, 40] as const;
const CAUSES = ['speed', 'narrowing', 'sway', 'sneeze', 'rush', 'other'] as const;
type Cause = (typeof CAUSES)[number];

/** The tap of the layer that is falling now. */
interface Tap {
  index: number;
  width: number;
  /** Offset from the top at the moment of the tap (the bot's timing error times the speed). */
  timingOff: number;
  /** Where the top was at the tap. */
  targetAtTap: number;
  speed: number;
  rush: boolean;
  /** A showcase layer without the rush (only the side of departure acts on it). */
  showcase: boolean;
}

const topTarget = (s: Readonly<TowerState>): number => {
  const top = s.layers.at(-1);
  return top ? top.x + wobbleOffset(s.wobble, s.wobblePhase, 0) : BALANCE.tray.centerX;
};

const lands = (offset: number, width: number): boolean =>
  Math.abs(offset) < width - BALANCE.drop.missMargin;

/** Watches one profile and team: heights come from the results, causes from the events. */
class FirstLayersStats implements RunObserver {
  readonly causes = new Map<Cause, number>(CAUSES.map((c) => [c, 0]));
  /** Ends below the limit, by flags that are not causes. */
  showcaseEnds = 0;
  startSpeedSaves = 0;
  causeRuns = 0;
  readonly missWidths: number[] = [];
  readonly missErrorsMs: number[] = [];
  readonly widthAt = new Map<number, number[]>(WIDTH_AT.map((h) => [h, []]));
  readonly speedAt = new Map<number, number[]>(WIDTH_AT.map((h) => [h, []]));
  perfects = 0;
  drops = 0;
  private tap: Tap | null = null;
  private dropMissCause: {
    cause: Cause;
    showcase: boolean;
    startSaves: boolean;
    width: number;
  } | null = null;

  noteDrop(s: Readonly<TowerState>): void {
    const f = s.flying;
    if (!f) return;
    const targetAtTap = topTarget(s);
    const speed = flyingSpeed(f);
    this.tap = {
      index: f.index,
      width: f.width,
      timingOff: f.x - targetAtTap,
      targetAtTap,
      speed,
      rush: f.rush,
      showcase: !f.rush && (f.rule === 'showcase' || f.rule2 === 'showcase'),
    };
    if (f.index <= CAUSE_LIMIT) this.drops += 1;
    this.widthAt.get(f.index)?.push(f.width);
    this.speedAt.get(f.index)?.push(f.speed);
  }

  noteEvents(events: readonly SimEvent[], s: Readonly<TowerState>): void {
    for (const event of events) {
      if (event.type === 'land' && this.tap && this.tap.index <= CAUSE_LIMIT) {
        if (event.quality === 'perfect') this.perfects += 1;
      }
      if (event.type === 'miss' && !event.shielded && !events.some((e) => e.type === 'land')) {
        this.dropMissCause = this.classifyDropMiss(s);
      }
      if (event.type !== 'run_over') continue;
      const result = event.result;
      if (result.height < CAUSE_LIMIT) {
        this.causeRuns += 1;
        let cause: Cause = 'other';
        if (result.endReason === 'sneeze') cause = 'sneeze';
        else if (this.dropMissCause) {
          cause = this.dropMissCause.cause;
          if (this.dropMissCause.showcase) this.showcaseEnds += 1;
          if (this.dropMissCause.startSaves) this.startSpeedSaves += 1;
          this.missWidths.push(this.dropMissCause.width);
        }
        this.causes.set(cause, (this.causes.get(cause) ?? 0) + 1);
      }
      this.dropMissCause = null;
      this.tap = null;
    }
  }

  private classifyDropMiss(s: Readonly<TowerState>): FirstLayersStats['dropMissCause'] {
    const tap = this.tap;
    if (!tap) return null;
    const sway = tap.targetAtTap - topTarget(s);
    const { width, timingOff, speed } = tap;
    const start = BALANCE.speed.start;
    const startSaves = speed > 0 && lands((timingOff * start) / speed + sway, width);
    let cause: Cause;
    if (lands(timingOff, width)) cause = 'sway';
    else if (tap.rush && lands(timingOff / ZONE_RULES.rush.speedMult + sway, width)) cause = 'rush';
    else if (width >= WIDE_LAYER) cause = 'speed';
    else cause = 'narrowing';
    if (speed > 0) this.missErrorsMs.push((1000 * Math.abs(timingOff)) / speed);
    return { cause, showcase: tap.showcase, startSaves, width };
  }
}

const pct = (count: number, total: number): number =>
  Number(((100 * count) / Math.max(1, total)).toFixed(1));
/** 95% half-width of a share in percentage points. */
const noisePp = (share: number, runs: number): number =>
  Number((196 * Math.sqrt((share * (1 - share)) / Math.max(1, runs))).toFixed(1));
const med = (values: number[]): number =>
  values.length
    ? percentile(
        [...values].sort((a, b) => a - b),
        0.5,
      )
    : 0;

interface CellReport {
  summary: Record<string, string | number>;
  histogram: Record<string, string | number>;
  hazard: Record<string, string | number>;
  causes: Record<string, string | number>;
  widths: Record<string, string | number>;
}

/** A team of `--teams=`: a set name of `SIM_TEAMS`, optionally `@level` (default `--level`). */
function playCell(
  profileId: string,
  teamSpec: string,
  runs: number,
  defaultLevel: number,
): CellReport {
  const [teamName = '', levelText] = teamSpec.split('@');
  const level = levelText === undefined ? defaultLevel : Number(levelText);
  if (!Number.isInteger(level) || level <= 0) throw new Error(`Invalid team: ${teamSpec}`);
  const target = DIFFICULTY.targets.find((t) => t.id === profileId);
  if (!target) throw new Error(`Unknown profile: ${profileId}`);
  const set = SIM_TEAMS.find((t) => t.name === teamName);
  if (!set) throw new Error(`Unknown team: ${teamName}`);
  const { seeds, noise } = profileStreams(target.id);
  const team = teamSlots(set, level);
  const stats = new FirstLayersStats();
  const heights: number[] = [];
  const coins: number[] = [];
  let perfects = 0;
  const seconds: number[] = [];
  for (let i = 0; i < runs; i++) {
    const seed = seeds.int(0, 0xffffffff);
    const result = playRun(
      { seed, mode: 'classic', team, tutorial: false },
      target,
      noise,
      [stats],
      ANALYSIS_MAX_HEIGHT,
    );
    heights.push(result.height);
    coins.push(result.coins);
    perfects += result.perfects;
    seconds.push(result.durationMs / 1000);
  }
  const sorted = [...heights].sort((a, b) => a - b);
  const name = `${profileId}/${teamName === NO_TEAM.name ? 'none' : `${teamName} L${level}`}`;
  const lo = Math.max(0.5 - 0.98 / Math.sqrt(runs), 0);
  const summary: CellReport['summary'] = {
    cell: name,
    runs,
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    'median 95%': `${percentile(sorted, lo)}-${percentile(sorted, 1 - lo)}`,
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    mean: Number(mean(heights).toFixed(1)),
  };
  for (const h of SHARE_BELOW) {
    const share = heights.filter((x) => x < h).length / runs;
    summary[`<${h}, %`] = `${pct(share * runs, runs)} ±${noisePp(share, runs)}`;
  }
  summary['coins/run'] = Number(mean(coins).toFixed(1));
  // What a save keeps: stats.perfects over stats.totalLayers (twins' bonus height left in).
  summary['perfect %'] = pct(
    perfects,
    heights.reduce((sum, h) => sum + h, 0),
  );
  summary['s/run'] = Number(mean(seconds).toFixed(1));

  const histogram: CellReport['histogram'] = { cell: name };
  HISTOGRAM.forEach((from, i) => {
    const to = HISTOGRAM[i + 1];
    const count = heights.filter((x) => x >= from && (to === undefined || x < to)).length;
    histogram[to === undefined ? `${from}+` : `${from}-${to - 1}`] = pct(count, runs);
  });

  // Hazard of a band: runs that ended with a height in it over the runs that reached its start.
  const hazard: CellReport['hazard'] = { cell: name };
  HAZARD_BANDS.slice(0, -1).forEach((from, i) => {
    const to = (HAZARD_BANDS[i + 1] ?? from) - 1;
    // Lost on layer L means ended with height L - 1.
    const reached = heights.filter((x) => x >= from - 1).length;
    const ended = heights.filter((x) => x >= from - 1 && x <= to - 1).length;
    const perLayer = 1 - Math.pow(1 - ended / Math.max(1, reached), 1 / (to - from + 1));
    hazard[`${from}-${to}`] = Number((100 * perLayer).toFixed(1));
  });

  const causes: CellReport['causes'] = { cell: name, 'ends <40': stats.causeRuns };
  for (const cause of CAUSES) {
    causes[cause] = pct(stats.causes.get(cause) ?? 0, stats.causeRuns);
  }
  causes['showcase no rush'] = pct(stats.showcaseEnds, stats.causeRuns);
  causes['start speed saves'] = pct(stats.startSpeedSaves, stats.causeRuns);
  causes['miss width med'] = Math.round(med(stats.missWidths));
  causes['miss error med, ms'] = Math.round(med(stats.missErrorsMs));
  causes['perfect % (1-40)'] = pct(stats.perfects, stats.drops);

  const widths: CellReport['widths'] = { cell: name };
  for (const h of WIDTH_AT) {
    widths[`width@${h}`] = Math.round(med(stats.widthAt.get(h) ?? []));
    widths[`speed@${h}`] = Math.round(med(stats.speedAt.get(h) ?? []) || speedCurve(h - 1));
  }
  return { summary, histogram, hazard, causes, widths };
}

function listArg(name: string, fallback: string[]): string[] {
  const prefix = `--${name}=`;
  const arg = scriptArgs().find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length).split(',').filter(Boolean) : fallback;
}

function main(): void {
  const args = scriptArgs();
  const known = ['--runs=', '--profiles=', '--teams=', '--level=', '--set='];
  for (const arg of args) {
    if (!known.some((k) => arg.startsWith(k))) throw new Error(`Unknown argument: ${arg}`);
  }
  const runs = intArg(args, 'runs', 4000);
  const level = intArg(args, 'level', SIM_TEAM_LEVEL);
  const profiles = listArg('profiles', ['novice', 'regular', 'expert', 'strong']);
  const teams = listArg('teams', [NO_TEAM.name, 'reliable']);
  const sets = applySets(setArg(args));
  console.log(
    `Runs per cell: ${runs}, team level ${level}, continues declined` +
      (sets.length ? `, what-if: ${sets.join('; ')}` : ''),
  );
  const reports = profiles.flatMap((p) => teams.map((t) => playCell(p, t, runs, level)));
  console.log('\nEnd height (layers); shares with the 95% noise half-width');
  console.table(reports.map((r) => r.summary));
  console.log('\nEnd height histogram, % of runs');
  console.table(reports.map((r) => r.histogram));
  console.log('\nHazard per layer in a band, %: P(lost on a layer | reached it), band average');
  console.table(reports.map((r) => r.hazard));
  console.log(`\nCause of the run end, % of the runs that ended below ${CAUSE_LIMIT}`);
  console.table(reports.map((r) => r.causes));
  console.log('\nMedian width (px) and nominal speed (px/s) of the flying layer at a layer number');
  console.table(reports.map((r) => r.widths));
}

main();

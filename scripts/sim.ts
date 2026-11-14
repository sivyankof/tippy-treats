import { TimingBot } from '../src/core/bot';
import { Rng } from '../src/core/rng';
import type { RunResult } from '../src/core/run-result';
import type { RunConfig } from '../src/core/sim-types';
import { TowerSim } from '../src/core/tower-sim';
import { BALANCE, DIFFICULTY, type DifficultyTarget } from '../src/data/balance';
import { ZONES } from '../src/data/zones';
import {
  NO_TEAM,
  allFullTeams,
  SIM_TEAMS,
  SIM_TEAM_LEVEL,
  isFullTeam,
  type SimTeamSet,
} from '../src/data/sim-teams';
import { WobbleStats, type WobbleRow } from './wobble-stats';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: { argv: string[] };

const STEP_MS = BALANCE.sim.stepMs;
const BASE_SEED = 20261113;
/** Safety net for a bot that never misses. */
const MAX_RUN_MS = 60 * 60 * 1000;
/** Median height gain of a full level-3 team expected by the M4 exit criteria, in percent. */
const GAIN_RANGE_PCT = [30, 50] as const;
/** Owner's acceptance criteria for the creature balance. */
const JELLY_PROFILE = 'regular';
const JELLY_SOLO_RANGE_PCT = [8, 14] as const;
const TOP_COUNT = 5;
const RAINBOW = 'rainbow';
const GHOST = 'ghost';

interface CliOptions {
  runs: number;
  profile: string | null;
  team: string | null;
  level: number;
  allTeams: boolean;
}

/** Reads `--runs=N --profile=id --team=name --level=N --all-teams`; anything else is an error. */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runs: DIFFICULTY.runsPerProfile,
    profile: null,
    team: null,
    level: SIM_TEAM_LEVEL,
    allTeams: false,
  };
  for (const arg of argv) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'all-teams' && !value) options.allTeams = true;
    else if (key === 'runs' && Number(value) > 0) options.runs = Math.floor(Number(value));
    else if (key === 'level' && Number(value) > 0) options.level = Math.floor(Number(value));
    else if (key === 'profile' && value) options.profile = value;
    else if (key === 'team' && value) options.team = value;
    else throw new Error(`Unknown or invalid argument: ${arg}`);
  }
  return options;
}

/** One bot run. The bot never continues a run. `wobble` collects tap statistics if given. */
function playRun(
  config: RunConfig,
  timingSdMs: number,
  noise: Rng,
  wobble?: WobbleStats,
): RunResult {
  const sim = new TowerSim(config);
  const bot = new TimingBot(timingSdMs, noise);

  for (let elapsed = 0; elapsed < MAX_RUN_MS; elapsed += STEP_MS) {
    const events = sim.update(STEP_MS);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());
    bot.observe(events);
    wobble?.noteEvents(events);

    for (const event of events) {
      if (event.type === 'run_over') return event.result;
    }

    if (bot.shouldDrop(sim)) {
      wobble?.noteDrop(sim.state);
      sim.drop();
    }
  }
  throw new Error(`Run with seed ${config.seed} did not end`);
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? 0;
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function verdict(median: number, [min, max]: DifficultyTarget['medianHeight']): string {
  if (median >= min && median <= max) return 'ok';
  const { tolerance } = DIFFICULTY;
  if (median >= min * (1 - tolerance) && median <= max * (1 + tolerance)) return 'near';
  return 'OFF';
}

const teamSlots = (set: SimTeamSet, level: number): RunConfig['team'] =>
  Array.from({ length: BALANCE.team.slots }, (_, i) => {
    const id = set.creatures[i];
    return id ? { id, level } : null;
  });

/** Plays all runs of one profile with one team; seeds and bot noise are the same for every team. */
function playProfile(
  target: DifficultyTarget,
  set: SimTeamSet,
  options: CliOptions,
  wobble?: WobbleStats,
): { results: RunResult[]; heights: number[] } {
  const seeds = new Rng(BASE_SEED).fork(`seeds:${target.id}`);
  const noise = new Rng(BASE_SEED).fork(`noise:${target.id}`);
  const team = teamSlots(set, options.level);
  const results: RunResult[] = [];
  for (let i = 0; i < options.runs; i++) {
    const seed = seeds.int(0, 0xffffffff);
    results.push(
      playRun({ seed, mode: 'classic', team, tutorial: false }, target.timingSdMs, noise, wobble),
    );
  }
  const heights = results.map((r) => r.height).sort((a, b) => a - b);
  return { results, heights };
}

interface TeamRow {
  team: string;
  full: boolean;
  median: number;
  p90: number;
  'median zone': string;
  'delta median, %': number | string;
  'avg coins': number;
  'avg score': number;
  'avg berries': number;
  'avg time, s': number;
}

const TABLE_COLUMNS: Array<keyof TeamRow> = [
  'team',
  'median',
  'p90',
  'median zone',
  'delta median, %',
  'avg coins',
  'avg score',
  'avg berries',
  'avg time, s',
];

/** Id of the zone the median run ended in. */
function medianZone(results: RunResult[]): string {
  const zones = results.map((r) => r.zoneIndex).sort((a, b) => a - b);
  return ZONES[percentile(zones, 0.5)]?.id ?? '-';
}

function summarize(set: SimTeamSet, results: RunResult[], heights: number[]): TeamRow {
  return {
    team: set.name,
    full: isFullTeam(set),
    median: percentile(heights, 0.5),
    p90: percentile(heights, 0.9),
    'median zone': medianZone(results),
    'delta median, %': 0,
    'avg coins': Number(mean(results.map((r) => r.coins)).toFixed(1)),
    'avg score': Math.round(mean(results.map((r) => r.score))),
    'avg berries': Number(mean(results.map((r) => r.berries)).toFixed(2)),
    'avg time, s': Number((mean(results.map((r) => r.durationMs)) / 1000).toFixed(1)),
  };
}

const deltaPct = (median: number, base: number): number =>
  Number(((100 * (median - base)) / Math.max(1, base)).toFixed(1));

const gainOf = (row: TeamRow): number => Number(row['delta median, %']);
const hasCreature = (row: TeamRow, id: string): boolean => row.team.split('+').includes(id);
const describeRow = (row: TeamRow): string =>
  `${row.team} (median ${row.median}, ${gainOf(row)}%, coins ${row['avg coins']})`;
const names = (rows: TeamRow[]): string =>
  rows.length ? rows.map(describeRow).join('; ') : 'none';

/**
 * Prints the check over the given full teams of one profile and returns the dominant ones.
 * Dominance is only judged over every 3-creature team (`judgeDominance`); the six named
 * teams are too few for it, so without `--all-teams` it is reported as not checked.
 */
function checkFullTeams(profile: string, full: TeamRow[], judgeDominance: boolean): TeamRow[] {
  if (full.length === 0) return [];
  const [lo, hi] = GAIN_RANGE_PCT;
  const inRange = full.filter((r) => gainOf(r) >= lo && gainOf(r) <= hi);
  console.log(
    `[${profile}] full teams within +${lo}..+${hi}% median height: ` +
      (inRange.length ? inRange.map((r) => `${r.team} (${gainOf(r)}%)`).join(', ') : 'none'),
  );

  const bestMedian = Math.max(...full.map((r) => r.median));
  const bestCoins = Math.max(...full.map((r) => r['avg coins']));
  const dominant = full.filter((r) => r.median === bestMedian && r['avg coins'] === bestCoins);
  console.log(
    `[${profile}] best median ${bestMedian}: ${full
      .filter((r) => r.median === bestMedian)
      .map((r) => r.team)
      .join(', ')}; best avg coins ${bestCoins}: ${full
      .filter((r) => r['avg coins'] === bestCoins)
      .map((r) => r.team)
      .join(', ')}`,
  );
  if (!judgeDominance) {
    console.log(`[${profile}] dominance: not checked, the check needs --all-teams`);
    return [];
  }
  console.log(
    `[${profile}] dominance: ` +
      (dominant.length
        ? `FAIL, ${dominant.map((r) => r.team).join(', ')} leads in height and coins`
        : 'ok, no full team leads in both height and coins'),
  );
  return dominant;
}

/** Summary of all 3-creature teams of one profile; returns those over the upper gain bound without rainbow and ghost. */
function summarizeAllTeams(profile: string, rows: TeamRow[]): TeamRow[] {
  const [lo, hi] = GAIN_RANGE_PCT;
  const top = (key: 'median' | 'avg coins') =>
    [...rows].sort((a, b) => b[key] - a[key]).slice(0, TOP_COUNT);
  const over = rows.filter((r) => gainOf(r) > hi);
  const withRainbow = over.filter((r) => hasCreature(r, RAINBOW));
  const withGhost = over.filter((r) => !hasCreature(r, RAINBOW) && hasCreature(r, GHOST));
  const plain = over.filter((r) => !hasCreature(r, RAINBOW) && !hasCreature(r, GHOST));
  console.log(`\n[${profile}] summary of ${rows.length} full teams`);
  console.log(`  top ${TOP_COUNT} by median: ${names(top('median'))}`);
  console.log(`  top ${TOP_COUNT} by avg coins: ${names(top('avg coins'))}`);
  console.log(
    `  within +${lo}..+${hi}%: ${rows.filter((r) => gainOf(r) >= lo && gainOf(r) <= hi).length}, ` +
      `over +${hi}%: ${over.length}`,
  );
  console.log(`  over +${hi}% with ${RAINBOW}: ${names(withRainbow)}`);
  console.log(`  over +${hi}% without ${RAINBOW}, with ${GHOST}: ${names(withGhost)}`);
  console.log(`  over +${hi}% without ${RAINBOW} and ${GHOST}: ${names(plain)}`);
  return plain;
}

const status = (ok: boolean): string => (ok ? 'ok' : 'FAIL');

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const targets = DIFFICULTY.targets.filter((t) => !options.profile || t.id === options.profile);
  if (targets.length === 0) throw new Error(`Unknown profile: ${options.profile}`);

  // The baseline is always played: every delta is measured against it.
  const sets = SIM_TEAMS.filter(
    (set) => !options.team || set.name === options.team || set.name === NO_TEAM.name,
  );
  if (options.team && !sets.some((set) => set.name === options.team)) {
    throw new Error(`Unknown team: ${options.team}`);
  }
  const everyTeam = options.allTeams ? allFullTeams() : [];

  console.log(
    `Runs per profile and team: ${options.runs}${options.runs === DIFFICULTY.runsPerProfile ? '' : ' (overridden)'}, ` +
      `team level: ${options.level}, team sets: ${sets.length}${options.allTeams ? ` + ${everyTeam.length} full teams (--all-teams)` : ''}, continues: declined`,
  );

  const wobbleRows: WobbleRow[] = [];
  const dominantTeams: string[] = [];
  const plainOverTeams: string[] = [];
  let jellySolo: number | null = null;
  for (const target of targets) {
    const play = (set: SimTeamSet, wobble?: WobbleStats): TeamRow => {
      const { results, heights } = playProfile(target, set, options, wobble);
      return summarize(set, results, heights);
    };
    const rows = sets.map((set) => {
      // Wobble is measured on the baseline only, where no ability changes it.
      const wobble = set === NO_TEAM ? new WobbleStats() : undefined;
      const row = play(set, wobble);
      if (wobble) wobbleRows.push(wobble.row(target.id));
      return row;
    });
    const base = rows.find((r) => r.team === NO_TEAM.name)?.median ?? 1;
    const fillDelta = (row: TeamRow): void => {
      row['delta median, %'] = row.team === NO_TEAM.name ? '-' : deltaPct(row.median, base);
    };
    rows.forEach(fillDelta);

    console.log(
      `\nProfile ${target.id} (sd ${target.timingSdMs} ms), target median ${target.medianHeight.join('-')}, ` +
        `baseline status: ${verdict(base, target.medianHeight)}`,
    );
    console.table(rows, TABLE_COLUMNS);

    const jelly = rows.find((r) => r.team === 'jelly');
    if (jelly) {
      console.log(`[${target.id}] jelly solo: ${gainOf(jelly) > 0 ? '+' : ''}${gainOf(jelly)}%`);
      if (target.id === JELLY_PROFILE) jellySolo = gainOf(jelly);
    }

    if (options.allTeams) {
      const full = everyTeam.map((set) => {
        const row = play(set);
        fillDelta(row);
        return row;
      });
      dominantTeams.push(
        ...checkFullTeams(target.id, full, true).map((r) => `${target.id}: ${r.team}`),
      );
      plainOverTeams.push(
        ...summarizeAllTeams(target.id, full).map((r) => `${target.id}: ${describeRow(r)}`),
      );
    } else {
      const named = rows.filter((r) => r.full);
      dominantTeams.push(
        ...checkFullTeams(target.id, named, false).map((r) => `${target.id}: ${r.team}`),
      );
    }
  }

  console.log(`\nWobble at the moment of the tap, no team (the first layer on the tray excluded)`);
  console.table(wobbleRows);

  console.log(
    `\nverdict: ${
      !options.allTeams
        ? 'the dominance check needs --all-teams'
        : dominantTeams.length
          ? 'a full team leads in both height and coins, balance needs changes'
          : 'no full team leads in both height and coins'
    }`,
  );
  console.log(
    `status of the baseline: ok = median inside the target range, near = within ${DIFFICULTY.tolerance * 100}% of it, OFF = median outside the target range by more than the tolerance`,
  );

  const [jLo, jHi] = JELLY_SOLO_RANGE_PCT;
  console.log(`\nAcceptance criteria${options.allTeams ? '' : ' (2 and 3 need --all-teams)'}`);
  console.log(
    `(1) jelly solo at ${JELLY_PROFILE} within +${jLo}..+${jHi}%: ` +
      (jellySolo === null
        ? `n/a (profile ${JELLY_PROFILE} was not played)`
        : `${status(jellySolo >= jLo && jellySolo <= jHi)} (${jellySolo}%)`),
  );
  if (options.allTeams) {
    console.log(
      `(2) no dominant team on any profile (${everyTeam.length} teams): ${status(dominantTeams.length === 0)}` +
        (dominantTeams.length ? ` (${dominantTeams.join(', ')})` : ''),
    );
    console.log(
      `(3) no full team without ${RAINBOW} and ${GHOST} over +${GAIN_RANGE_PCT[1]}% on any profile: ${status(plainOverTeams.length === 0)}` +
        (plainOverTeams.length ? ` (${plainOverTeams.join('; ')})` : ''),
    );
  }
}

main();

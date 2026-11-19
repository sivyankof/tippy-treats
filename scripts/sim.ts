import type { RunResult } from '../src/core/run/run-result';
import { DIFFICULTY, type DifficultyTarget } from '../src/data/tower/balance';
import { ZONES } from '../src/data/zones/zones';
import {
  NO_TEAM,
  allFullTeams,
  SIM_TEAMS,
  SIM_TEAM_LEVEL,
  isFullTeam,
  type SimTeamSet,
} from '../src/data/debug/sim-teams';
import { printCheckpointSection } from './checkpoint-section';
import { EndStats, type EndRow } from './end-stats';
import type { RunObserver } from './run-observer';
import { mean, percentile, playRun, profileStreams, signedPct, teamSlots } from './sim-runner';
import { WobbleStats, type WobbleRow } from './wobble-stats';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: { argv: string[]; exitCode?: number };

/** Median height gain of a full level-3 team expected by the M4 exit criteria, in percent. */
const GAIN_RANGE_PCT = [30, 50] as const;
/**
 * Owner's rule: a team counts as "over +50%" only past the upper bound plus this many percentage
 * points, so the noise of 2000 runs (one layer is about 3 points for the regular profile) does
 * not stop the check.
 */
const GAIN_OVER_TOLERANCE_PP = 3;
const OVER_LIMIT_PCT = GAIN_RANGE_PCT[1] + GAIN_OVER_TOLERANCE_PP;
/**
 * Owner's acceptance criteria for the creature balance: the median gain of a lone Jelly by profile.
 * The regular one is +8..+18 since 2026-11-19 (owner's decision): after session 7b its run is
 * longer and the spring of every layer adds up, the creature itself did not change.
 */
const JELLY_SOLO_RANGE_PCT: Readonly<Record<string, readonly [number, number]>> = {
  novice: [8, 14],
  regular: [8, 18],
  expert: [8, 14],
};
for (const profile of Object.keys(JELLY_SOLO_RANGE_PCT)) {
  if (!DIFFICULTY.targets.some((t) => t.id === profile)) {
    throw new Error(`jelly solo range for an unknown profile: ${profile}`);
  }
}
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

function verdict(median: number, [min, max]: DifficultyTarget['medianHeight']): string {
  if (median >= min && median <= max) return 'ok';
  const { tolerance } = DIFFICULTY;
  if (median >= min * (1 - tolerance) && median <= max * (1 + tolerance)) return 'near';
  return 'OFF';
}

/** Plays all runs of one profile with one team; seeds and bot noise are the same for every team. */
function playProfile(
  target: DifficultyTarget,
  set: SimTeamSet,
  options: CliOptions,
  observers: readonly RunObserver[] = [],
): { results: RunResult[]; heights: number[] } {
  const { seeds, noise } = profileStreams(target.id);
  const team = teamSlots(set, options.level);
  const results: RunResult[] = [];
  for (let i = 0; i < options.runs; i++) {
    const seed = seeds.int(0, 0xffffffff);
    results.push(
      playRun({ seed, mode: 'classic', team, tutorial: false }, target, noise, observers),
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
  const over = rows.filter((r) => gainOf(r) > OVER_LIMIT_PCT);
  const withRainbow = over.filter((r) => hasCreature(r, RAINBOW));
  const withGhost = over.filter((r) => !hasCreature(r, RAINBOW) && hasCreature(r, GHOST));
  const plain = over.filter((r) => !hasCreature(r, RAINBOW) && !hasCreature(r, GHOST));
  console.log(`\n[${profile}] summary of ${rows.length} full teams`);
  console.log(`  top ${TOP_COUNT} by median: ${names(top('median'))}`);
  console.log(`  top ${TOP_COUNT} by avg coins: ${names(top('avg coins'))}`);
  console.log(
    `  within +${lo}..+${hi}%: ${rows.filter((r) => gainOf(r) >= lo && gainOf(r) <= hi).length}, ` +
      `over +${hi}% (beyond +${OVER_LIMIT_PCT}%): ${over.length}`,
  );
  console.log(`  over +${OVER_LIMIT_PCT}% with ${RAINBOW}: ${names(withRainbow)}`);
  console.log(`  over +${OVER_LIMIT_PCT}% without ${RAINBOW}, with ${GHOST}: ${names(withGhost)}`);
  console.log(`  over +${OVER_LIMIT_PCT}% without ${RAINBOW} and ${GHOST}: ${names(plain)}`);
  return plain;
}

const status = (ok: boolean): string => (ok ? 'ok' : 'FAIL');

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const targets = DIFFICULTY.targets.filter((t) =>
    options.profile ? t.id === options.profile : !t.analysisOnly,
  );
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
  const zoneRows: EndRow[] = [];
  const missRows: EndRow[] = [];
  const dominantTeams: string[] = [];
  const plainOverTeams: string[] = [];
  const jellySolo = new Map<string, number>();
  const baselineOk: boolean[] = [];
  for (const target of targets) {
    const play = (set: SimTeamSet, observers: readonly RunObserver[] = []): TeamRow => {
      const { results, heights } = playProfile(target, set, options, observers);
      return summarize(set, results, heights);
    };
    const rows = sets.map((set) => {
      // Wobble and run ends are measured on the baseline only, where no ability changes them.
      if (set !== NO_TEAM) return play(set);
      const wobble = new WobbleStats();
      const ends = new EndStats();
      const row = play(set, [wobble, ends]);
      wobbleRows.push(wobble.row(target.id));
      zoneRows.push(ends.zoneRow(target.id));
      missRows.push(ends.missRow(target.id));
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
    baselineOk.push(verdict(base, target.medianHeight) !== 'OFF');
    console.table(rows, TABLE_COLUMNS);

    const jelly = rows.find((r) => r.team === 'jelly');
    if (jelly) {
      console.log(`[${target.id}] jelly solo: ${signedPct(gainOf(jelly))}`);
      jellySolo.set(target.id, gainOf(jelly));
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

  console.log(`
Zone the run ended in, % of runs, no team`);
  console.table(zoneRows);
  console.log(
    `
Rule on the layer the run was lost on, % of runs, no team ` +
      `(space layers by the rule they drew; "cloud at tap": the layer was covered when the bot tapped)`,
  );
  console.table(missRows);

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

  console.log(`\nAcceptance criteria${options.allTeams ? '' : ' (2 and 3 need --all-teams)'}`);
  const jellyOk: boolean[] = [];
  for (const [profile, gain] of jellySolo) {
    const range = JELLY_SOLO_RANGE_PCT[profile];
    if (!range) {
      console.log(`(1) jelly solo at ${profile}: n/a (no range for this profile) (${gain}%)`);
      continue;
    }
    const [lo, hi] = range;
    const ok = gain >= lo && gain <= hi;
    jellyOk.push(ok);
    console.log(`(1) jelly solo at ${profile} within +${lo}..+${hi}%: ${status(ok)} (${gain}%)`);
  }
  if (jellySolo.size === 0) console.log('(1) jelly solo: n/a (the jelly team was not played)');
  const criteriaOk = options.allTeams
    ? [dominantTeams.length === 0, plainOverTeams.length === 0]
    : [];
  if (options.allTeams) {
    console.log(
      `(2) no dominant team on any profile (${everyTeam.length} teams): ${status(dominantTeams.length === 0)}` +
        (dominantTeams.length ? ` (${dominantTeams.join(', ')})` : ''),
    );
    console.log(
      `(3) no full team without ${RAINBOW} and ${GHOST} over +${GAIN_RANGE_PCT[1]}% (beyond +${OVER_LIMIT_PCT}% with the owner's noise tolerance) on any profile: ${status(plainOverTeams.length === 0)}` +
        (plainOverTeams.length ? ` (${plainOverTeams.join('; ')})` : ''),
    );
  }

  const checkpoints = printCheckpointSection(options.runs, options.profile);
  const verdicts = [...baselineOk, ...jellyOk, ...criteriaOk];
  const ok = verdicts.filter(Boolean).length + checkpoints.ok;
  const fail = verdicts.length - verdicts.filter(Boolean).length + checkpoints.fail;
  console.log(
    `\nAll checks: ${ok} ok, ${checkpoints.reference} reference, ${fail} FAIL ` +
      `(baseline medians ok or near, ${jellyOk.length ? 'jelly solo, ' : ''}${options.allTeams ? 'dominance and teams over the gain range, ' : ''}checkpoint starts)`,
  );
  // A failed verdict stops a script chain (`npm run sim && ...`).
  if (fail > 0) process.exitCode = 1;
}

main();

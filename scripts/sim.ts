import { TimingBot } from '../src/core/bot';
import { Rng } from '../src/core/rng';
import type { RunResult } from '../src/core/run-result';
import type { RunConfig } from '../src/core/sim-types';
import { TowerSim } from '../src/core/tower-sim';
import { BALANCE, DIFFICULTY, type DifficultyTarget } from '../src/data/balance';
import {
  NO_TEAM,
  SIM_TEAMS,
  SIM_TEAM_LEVEL,
  isFullTeam,
  type SimTeamSet,
} from '../src/data/sim-teams';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: { argv: string[] };

const STEP_MS = BALANCE.sim.stepMs;
const BASE_SEED = 20261113;
/** Safety net for a bot that never misses. */
const MAX_RUN_MS = 60 * 60 * 1000;
/** Median height gain of a full level-3 team expected by the M4 exit criteria, in percent. */
const GAIN_RANGE_PCT = [30, 50] as const;

interface CliOptions {
  runs: number;
  profile: string | null;
  team: string | null;
  level: number;
}

/** Reads `--runs=N --profile=id --team=name --level=N`; anything else is an error. */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runs: DIFFICULTY.runsPerProfile,
    profile: null,
    team: null,
    level: SIM_TEAM_LEVEL,
  };
  for (const arg of argv) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'runs' && Number(value) > 0) options.runs = Math.floor(Number(value));
    else if (key === 'level' && Number(value) > 0) options.level = Math.floor(Number(value));
    else if (key === 'profile' && value) options.profile = value;
    else if (key === 'team' && value) options.team = value;
    else throw new Error(`Unknown or invalid argument: ${arg}`);
  }
  return options;
}

/** One bot run. The bot never continues a run. */
function playRun(config: RunConfig, timingSdMs: number, noise: Rng): RunResult {
  const sim = new TowerSim(config);
  const bot = new TimingBot(timingSdMs, noise);

  for (let elapsed = 0; elapsed < MAX_RUN_MS; elapsed += STEP_MS) {
    const events = sim.update(STEP_MS);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());
    bot.observe(events);

    for (const event of events) {
      if (event.type === 'run_over') return event.result;
    }

    if (bot.shouldDrop(sim)) sim.drop();
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
): { results: RunResult[]; heights: number[] } {
  const seeds = new Rng(BASE_SEED).fork(`seeds:${target.id}`);
  const noise = new Rng(BASE_SEED).fork(`noise:${target.id}`);
  const team = teamSlots(set, options.level);
  const results: RunResult[] = [];
  for (let i = 0; i < options.runs; i++) {
    const seed = seeds.int(0, 0xffffffff);
    results.push(
      playRun({ seed, mode: 'classic', team, tutorial: false }, target.timingSdMs, noise),
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
  'delta median, %',
  'avg coins',
  'avg score',
  'avg berries',
  'avg time, s',
];

function summarize(set: SimTeamSet, results: RunResult[], heights: number[]): TeamRow {
  return {
    team: set.name,
    full: isFullTeam(set),
    median: percentile(heights, 0.5),
    p90: percentile(heights, 0.9),
    'delta median, %': 0,
    'avg coins': Number(mean(results.map((r) => r.coins)).toFixed(1)),
    'avg score': Math.round(mean(results.map((r) => r.score))),
    'avg berries': Number(mean(results.map((r) => r.berries)).toFixed(2)),
    'avg time, s': Number((mean(results.map((r) => r.durationMs)) / 1000).toFixed(1)),
  };
}

const deltaPct = (median: number, base: number): number =>
  Number(((100 * (median - base)) / Math.max(1, base)).toFixed(1));

/** Prints the check over the full teams of one profile and returns whether any team dominates. */
function checkFullTeams(profile: string, rows: TeamRow[]): boolean {
  const full = rows.filter((r) => r.full);
  if (full.length === 0) return false;
  const [lo, hi] = GAIN_RANGE_PCT;
  const inRange = full.filter((r) => {
    const gain = Number(r['delta median, %']);
    return gain >= lo && gain <= hi;
  });
  console.log(
    `[${profile}] full teams within +${lo}..+${hi}% median height: ` +
      (inRange.length
        ? inRange.map((r) => `${r.team} (${r['delta median, %']}%)`).join(', ')
        : 'none'),
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
  console.log(
    `[${profile}] dominance: ` +
      (dominant.length
        ? `FAIL, ${dominant.map((r) => r.team).join(', ')} leads in height and coins`
        : 'ok, no full team leads in both height and coins'),
  );
  return dominant.length > 0;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const targets = DIFFICULTY.targets.filter((t) => !options.profile || t.id === options.profile);
  if (targets.length === 0) throw new Error(`Unknown profile: ${options.profile}`);

  // The baseline is always played: every delta is measured against it.
  const sets = SIM_TEAMS.filter(
    (set) => !options.team || set.name === options.team || set.name === NO_TEAM.name,
  );
  if (sets.length === 1 && options.team) throw new Error(`Unknown team: ${options.team}`);

  console.log(
    `Runs per profile and team: ${options.runs}${options.runs === DIFFICULTY.runsPerProfile ? '' : ' (overridden)'}, ` +
      `team level: ${options.level}, team sets: ${sets.length}, continues: declined`,
  );

  let anyDominant = false;
  for (const target of targets) {
    const rows = sets.map((set) => {
      const { results, heights } = playProfile(target, set, options);
      return summarize(set, results, heights);
    });
    const base = rows.find((r) => r.team === NO_TEAM.name)?.median ?? 1;
    for (const row of rows) {
      row['delta median, %'] = row.team === NO_TEAM.name ? '-' : deltaPct(row.median, base);
    }

    console.log(
      `\nProfile ${target.id} (sd ${target.timingSdMs} ms), target median ${target.medianHeight.join('-')}, ` +
        `baseline status: ${verdict(base, target.medianHeight)}`,
    );
    console.table(rows, TABLE_COLUMNS);
    anyDominant = checkFullTeams(target.id, rows) || anyDominant;
  }

  console.log(
    `\nverdict: ${anyDominant ? 'a full team leads in both height and coins, balance needs changes' : 'no full team leads in both height and coins'}`,
  );
  console.log(
    `status of the baseline: ok = median inside the target range, near = within ${DIFFICULTY.tolerance * 100}% of it, OFF = balance needs changes`,
  );
}

main();

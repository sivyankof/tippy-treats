import { DIFFICULTY, type DifficultyTarget } from '../src/data/balance';
import { SAVE_DEFAULTS } from '../src/data/save-defaults';
import { NO_TEAM, allFullTeams, type SimTeamSet } from '../src/data/sim-teams';
import { COIN_SOURCES, CoinStats, type CoinsBySource } from './coin-stats';
import { nodeFs, scriptArgs } from './node-env';
import { mean, percentile, playRun, profileStreams, teamSlots } from './sim-runner';

/**
 * `npm run sim:coins`: coins per run by source, XP (= height) and run duration for every bot
 * profile, for three team setups: no team, the starter team of a new save, and the team with
 * the most coins per run found by brute force over all full teams, at creature levels 1 and 5.
 *
 * Duration is the sim clock of the run: spawn pauses, flight, fall and landing of every layer up
 * to the landing that ends the run. It does not include the miss slow-motion, the continue offer
 * (the bot declines it), the results screen or anything else a scene adds on top.
 */

const SEARCH_LEVELS = [1, 5] as const;
const DEFAULT_SEARCH_RUNS = 300;
const DEFAULT_TOP = 5;
/** A bot with a strong team at level 5 may never miss; such a run is cut off at this height. */
const DEFAULT_MAX_HEIGHT = 1500;
const MS_PER_SECOND = 1000;

interface CliOptions {
  runs: number;
  searchRuns: number;
  top: number;
  maxHeight: number;
  profile: string | null;
  json: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runs: DIFFICULTY.runsPerProfile,
    searchRuns: DEFAULT_SEARCH_RUNS,
    top: DEFAULT_TOP,
    maxHeight: DEFAULT_MAX_HEIGHT,
    profile: null,
    json: null,
  };
  for (const arg of argv) {
    const [key = '', ...rest] = arg.replace(/^--/, '').split('=');
    const value = rest.join('=');
    if (key === 'runs' && Number(value) > 0) options.runs = Math.floor(Number(value));
    else if (key === 'search-runs' && Number(value) > 0)
      options.searchRuns = Math.floor(Number(value));
    else if (key === 'top' && Number(value) > 0) options.top = Math.floor(Number(value));
    else if (key === 'max-height' && Number(value) > 0)
      options.maxHeight = Math.floor(Number(value));
    else if (key === 'profile' && value) options.profile = value;
    else if (key === 'json' && value) options.json = value;
    else throw new Error(`Unknown or invalid argument: ${arg}`);
  }
  return options;
}

interface Spread {
  mean: number;
  median: number;
  p10: number;
  p90: number;
}

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

function spread(values: number[], digits = 2): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: round(mean(values), digits),
    median: round(percentile(sorted, 0.5), digits),
    p10: round(percentile(sorted, 0.1), digits),
    p90: round(percentile(sorted, 0.9), digits),
  };
}

/** Per-run numbers of one cell (profile, team, level) summarised for the report and the JSON. */
interface Cell {
  team: string[];
  level: number;
  runs: number;
  /** Runs cut off at the height limit (their coins include the height bonus as if they had ended there). */
  censoredRuns: number;
  /** Mean coins per run by source; `total` is their sum as the run reports it. */
  coinsBySource: Record<string, number>;
  /** XP of a run is its height. */
  xp: number;
  durationSec: number;
  berries: number;
  distribution: {
    height: Spread;
    coins: Spread;
    durationSec: Spread;
    berriesFromGolden: Spread;
  };
}

/** Plays `runs` runs; the seeds and the bot noise are the same for every team of a profile. */
function evaluate(
  target: DifficultyTarget,
  set: SimTeamSet,
  level: number,
  runs: number,
  maxHeight: number,
): Cell {
  const { seeds, noise } = profileStreams(target.id);
  const team = teamSlots(set, level);
  const stats = new CoinStats();
  const results = Array.from({ length: runs }, () =>
    playRun(
      { seed: seeds.int(0, 0xffffffff), mode: 'classic', team, tutorial: false },
      target,
      noise,
      [stats],
      maxHeight,
    ),
  );
  const bySource: Record<string, number> = {};
  for (const source of COIN_SOURCES) {
    bySource[source] = round(mean(stats.runs.map((c: CoinsBySource) => c[source])));
  }
  const coins = stats.runs.map((c) => COIN_SOURCES.reduce((sum, source) => sum + c[source], 0));
  bySource.total = round(mean(coins));
  const heights = results.map((r) => r.height);
  const durations = results.map((r) => r.durationMs / MS_PER_SECOND);
  return {
    team: [...set.creatures],
    level,
    runs,
    censoredRuns: stats.censored,
    coinsBySource: bySource,
    xp: round(mean(heights)),
    durationSec: round(mean(durations), 1),
    berries: round(mean(results.map((r) => r.berries))),
    distribution: {
      height: spread(heights, 0),
      coins: spread(coins, 1),
      durationSec: spread(durations, 1),
      berriesFromGolden: spread(results.map((r) => r.berries)),
    },
  };
}

interface SearchRow {
  team: string;
  /** Mean coins per run in the screening pass. */
  screenCoins: number;
}

/**
 * Brute force over all full teams: every team is played `searchRuns` times, the best `top` are
 * replayed with the full run count and the winner is the best of those by mean coins.
 */
function bestTeam(
  target: DifficultyTarget,
  level: number,
  options: CliOptions,
  teams: SimTeamSet[],
): { cell: Cell; top: SearchRow[] } {
  const screened = teams
    .map((set) => ({
      set,
      screenCoins: round(
        evaluate(target, set, level, options.searchRuns, options.maxHeight).coinsBySource.total ??
          0,
      ),
    }))
    .sort((a, b) => b.screenCoins - a.screenCoins)
    .slice(0, options.top);
  const finals = screened
    .map(({ set }) => evaluate(target, set, level, options.runs, options.maxHeight))
    .sort((a, b) => (b.coinsBySource.total ?? 0) - (a.coinsBySource.total ?? 0));
  const winner = finals[0] as Cell;
  return {
    cell: winner,
    top: finals.map((cell) => ({
      team: cell.team.join('+'),
      screenCoins: cell.coinsBySource.total ?? 0,
    })),
  };
}

const LABELS = ['floating', 'combo', 'golden', 'height', 'perfect', 'crumb', 'total'] as const;

function row(setup: string, cell: Cell): Record<string, string | number> {
  const { height, coins, durationSec } = cell.distribution;
  return {
    setup,
    team: cell.team.join('+') || '-',
    runs: cell.runs,
    cut: cell.censoredRuns,
    'XP (height)': cell.xp,
    ...Object.fromEntries(LABELS.map((key) => [key, cell.coinsBySource[key] ?? 0])),
    berries: cell.berries,
    'time, s': cell.durationSec,
    'height p10/med/p90': `${height.p10}/${height.median}/${height.p90}`,
    'coins p10/med/p90': `${coins.p10}/${coins.median}/${coins.p90}`,
    'time p10/med/p90': `${durationSec.p10}/${durationSec.median}/${durationSec.p90}`,
  };
}

function main(): void {
  const options = parseArgs(scriptArgs());
  const targets = DIFFICULTY.targets.filter((t) => !options.profile || t.id === options.profile);
  if (targets.length === 0) throw new Error(`Unknown profile: ${options.profile}`);

  const teams = allFullTeams();
  const starter: SimTeamSet = { name: 'starter', creatures: SAVE_DEFAULTS.startCreatures };
  console.log(
    `Coins per run by source. Runs per cell: ${options.runs}; team search: ${teams.length} full teams x ${options.searchRuns} runs, ` +
      `best ${options.top} replayed with ${options.runs}; runs are cut off at height ${options.maxHeight} (column cut); starter team: ${starter.creatures.join('+')} at level ${SAVE_DEFAULTS.startCreatureLevel}.`,
  );
  console.log(
    'Columns: floating = floating coins; combo = perfect drops at combo >= 5; golden = normal drops of golden layers; height = height bonus; ' +
      'perfect and crumb = coins of the sprinkle-style and crumb abilities; XP = height; time = sim seconds up to the landing that ends the run ' +
      '(no miss slow-motion, continue offer or results screen).',
  );

  const report: Record<
    string,
    Record<string, Cell | { team: string; top: SearchRow[]; cell: Cell }>
  > = {};
  for (const target of targets) {
    const cells: Record<string, Cell | { team: string; top: SearchRow[]; cell: Cell }> = {};
    const rows: Array<Record<string, string | number>> = [];
    cells.none = evaluate(target, NO_TEAM, 1, options.runs, options.maxHeight);
    rows.push(row('no team', cells.none));
    cells.starter = evaluate(
      target,
      starter,
      SAVE_DEFAULTS.startCreatureLevel,
      options.runs,
      options.maxHeight,
    );
    rows.push(row(`starter L${SAVE_DEFAULTS.startCreatureLevel}`, cells.starter));
    for (const level of SEARCH_LEVELS) {
      const { cell, top } = bestTeam(target, level, options, teams);
      cells[`best_level_${level}`] = { team: cell.team.join('+'), top, cell };
      rows.push(row(`best L${level}`, cell));
      console.log(
        `[${target.id}] best coin team at level ${level}: ${top.map((t) => `${t.team} (${t.screenCoins})`).join(', ')}`,
      );
    }
    report[target.id] = cells;
    console.log(`\nProfile ${target.id} (sd ${target.timingSdMs} ms)`);
    console.table(rows);
  }

  if (options.json) {
    const meta = {
      runsPerCell: options.runs,
      searchRuns: options.searchRuns,
      maxHeight: options.maxHeight,
      searchTop: options.top,
      searchedTeams: teams.length,
      starterTeam: [...starter.creatures],
      starterLevel: SAVE_DEFAULTS.startCreatureLevel,
      searchLevels: [...SEARCH_LEVELS],
      coinSources: [...COIN_SOURCES],
      durationNote:
        'sim seconds up to the landing that ends the run; no slow-motion, continue offer or results screen',
    };
    nodeFs().writeFileSync(options.json, JSON.stringify({ meta, profiles: report }, null, 2));
    console.log(`\nJSON written to ${options.json}`);
  }
}

main();

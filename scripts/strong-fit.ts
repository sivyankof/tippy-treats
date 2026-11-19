import { DIFFICULTY } from '../src/data/tower/balance';
import { NO_TEAM } from '../src/data/debug/sim-teams';
import { CoinStats, type CoinsBySource } from './coin-stats';
import { intArg, scriptArgs } from './node-env';
import {
  ANALYSIS_MAX_HEIGHT,
  mean,
  percentile,
  playRun,
  profileStreams,
  teamSlots,
} from './sim-runner';

/**
 * How well the `strong` bot profile fits the live data of one tester (no team, no ads, no
 * debug): a 101-layer run gave 81 coins and a 34-layer run gave 25. Prints the height spread
 * and the coins by source of the runs that ended in the band around 100 layers.
 */
const LIVE_100 = { floating: 26, golden: 20, combo: 15, height: 20, total: 81 } as const;
const BAND = [95, 105] as const;
const SOURCES = ['floating', 'golden', 'combo', 'height'] as const;

const runs = intArg(scriptArgs(), 'runs', DIFFICULTY.runsPerProfile);
const target = DIFFICULTY.targets.find((t) => t.id === 'strong');
if (!target) throw new Error('No strong profile');

const { seeds, noise } = profileStreams(target.id);
const stats = new CoinStats();
const results = Array.from({ length: runs }, () =>
  playRun(
    {
      seed: seeds.int(0, 0xffffffff),
      mode: 'classic',
      team: teamSlots(NO_TEAM, 1),
      tutorial: false,
    },
    target,
    noise,
    [stats],
    ANALYSIS_MAX_HEIGHT,
  ),
);

const heights = results.map((r) => r.height).sort((a, b) => a - b);
console.log(`Profile strong (sd ${target.timingSdMs} ms), ${runs} runs, no team`);
console.log(
  `height: median ${percentile(heights, 0.5)}, p10 ${percentile(heights, 0.1)}, p90 ${percentile(heights, 0.9)}, mean ${mean(heights).toFixed(1)}`,
);

const band = results
  .map((result, i) => ({ result, coins: stats.runs[i] as CoinsBySource }))
  .filter(({ result }) => result.height >= BAND[0] && result.height <= BAND[1]);
const row = (get: (x: (typeof band)[number]) => number): number =>
  Number(mean(band.map(get)).toFixed(1));
console.table([
  {
    source: 'live (101 layers)',
    floating: LIVE_100.floating,
    golden: LIVE_100.golden,
    combo: LIVE_100.combo,
    height: LIVE_100.height,
    total: LIVE_100.total,
  },
  {
    source: `bot, ${band.length} runs of ${BAND[0]}-${BAND[1]} layers`,
    ...Object.fromEntries(SOURCES.map((key) => [key, row((x) => x.coins[key])])),
    total: row((x) => x.result.coins),
  },
]);

import { checkpointBerryPrice, checkpointHasAd } from '../src/core/checkpoints';
import { CHECKPOINT_HEIGHTS, CHECKPOINT_START_WIDTH } from '../src/data/zones/checkpoints';
import { BERRY_PACKS } from '../src/data/economy/economy';
import { NO_TEAM, type SimTeamSet } from '../src/data/debug/sim-teams';
import {
  START_HEIGHTS,
  WidthAtHeights,
  playCheckpointRuns,
  type CheckpointSample,
} from './checkpoint-runs';
import { SESSION_TIME } from './session-time';
import { mean, percentile } from './sim-runner';

/**
 * The checkpoint section of `npm run sim`: runs from every start height for the bot profiles,
 * compared with the run from zero of the same profile and team. A checkpoint start must not beat
 * the run from zero (docs/02-gameplay.md, section 10).
 */

/** Team of the strong player in the economy model, creature level 1. */
export const STRONG_COIN_TEAM: SimTeamSet = {
  name: 'coin',
  creatures: ['caramel', 'ghost', 'rainbow'],
};
const COIN_TEAM_LEVEL = 1;
const SECTION_PLAYERS: ReadonlyArray<{ profile: string; team: SimTeamSet; level: number }> = [
  { profile: 'novice', team: NO_TEAM, level: 1 },
  { profile: 'regular', team: NO_TEAM, level: 1 },
  { profile: 'expert', team: NO_TEAM, level: 1 },
  { profile: 'strong', team: NO_TEAM, level: 1 },
  { profile: 'strong', team: STRONG_COIN_TEAM, level: COIN_TEAM_LEVEL },
];
/** Owner's noise tolerance: about one layer for the regular profile. */
const TOLERANCE_PP = 3;

/** Coins one berry is worth at the worst exchange rate of the data (the strictest price of a berry start). */
const COINS_PER_BERRY = Math.min(...BERRY_PACKS.map((pack) => pack.coins / pack.berries));
if (!Number.isFinite(COINS_PER_BERRY)) throw new Error('no berry exchange pack');

/**
 * Coins per minute of play with the berries the run earned valued in coins, minus the berry price of
 * the start, over the run, the results screen and `extraSec` (the ad of an ad start).
 */
function valuePerPlayMin(stats: Stats, priceBerries: number, extraSec: number): number {
  const coins = stats.meanCoins + (stats.meanBerries - priceBerries) * COINS_PER_BERRY;
  return (coins / (stats.meanSeconds + SESSION_TIME.resultsSec + extraSec)) * 60;
}

const medianOf = (values: number[]): number =>
  percentile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
const deltaPct = (value: number, base: number): number =>
  Number(((100 * (value - base)) / Math.max(1e-9, base)).toFixed(1));
const verdict = (delta: number): string =>
  `${delta > 0 ? '+' : ''}${delta}% ${delta > TOLERANCE_PP ? 'FAIL' : 'ok'}`;

interface Stats {
  runs: number;
  medFull: number;
  medPlaced: number;
  medCoins: number;
  meanCoins: number;
  meanBerries: number;
  meanSeconds: number;
  coinsPerMin: number;
  layersPerMin: number;
  /** Per minute of play with the results screen after the run (a berry start, no ad). */
  coinsPerPlayMin: number;
  layersPerPlayMin: number;
  /** Mean coins over mean seconds with the results screen and an ad of the start (no price). */
}

function statsOf(samples: CheckpointSample[]): Stats {
  const seconds = mean(samples.map((s) => s.seconds));
  const coins = mean(samples.map((s) => s.coins));
  return {
    runs: samples.length,
    medFull: medianOf(samples.map((s) => s.full)),
    medPlaced: medianOf(samples.map((s) => s.placed)),
    medCoins: medianOf(samples.map((s) => s.coins)),
    meanCoins: coins,
    meanBerries: mean(samples.map((s) => s.berries)),
    meanSeconds: seconds,
    coinsPerMin: (coins / seconds) * 60,
    layersPerMin: (mean(samples.map((s) => s.placed)) / seconds) * 60,
    coinsPerPlayMin: (coins / (seconds + SESSION_TIME.resultsSec)) * 60,
    layersPerPlayMin:
      (mean(samples.map((s) => s.placed)) / (seconds + SESSION_TIME.resultsSec)) * 60,
  };
}

/** Prints the section; `profile` limits it to one profile like the `--profile=` option. */
export function printCheckpointSection(runs: number, profile: string | null): void {
  const players = SECTION_PLAYERS.filter((p) => !profile || p.profile === profile);
  console.log(
    `\n## Checkpoint starts: ${runs} runs per profile, team and start height, same seeds for every start, continues: declined`,
  );
  console.log(
    'Duration is the sim clock of the run (placed layers only). A start from a checkpoint must not beat the run from zero by more than ' +
      `${TOLERANCE_PP} percentage points on (a) median placed layers vs median height from zero, (b) median coins per run, (c) coins per minute, (d) placed layers per minute; (e) and (f) are (c) and (d) per minute of play with the ${SESSION_TIME.resultsSec} s results screen after every run; (g) and (h) count the price of the start, with berries at the worst exchange rate (${COINS_PER_BERRY} coins per berry): value = mean coins + (mean berries earned - berry price) x rate, per minute of run + ${SESSION_TIME.resultsSec} s results; (g) a berry start, (h) an ad start (heights with an ad only: no berry price, + ${SESSION_TIME.adSec} s ad). Both are compared with the same value of the run from zero (its berries counted, no price).`,
  );
  const widthRows: string[] = [];
  const failures: string[] = [];
  const verdictOf = (d: number, label: string): string => {
    const text = verdict(d);
    if (text.endsWith('FAIL')) failures.push(`${label}: ${text}`);
    return text;
  };
  for (const player of players) {
    const widths = new WidthAtHeights();
    const rows = START_HEIGHTS.map((start) => ({
      start,
      stats: statsOf(
        playCheckpointRuns({
          profileId: player.profile,
          team: player.team,
          level: player.level,
          start,
          runs,
          observers: start === 0 && player.team === NO_TEAM ? [widths] : [],
        }),
      ),
    }));
    const zero = rows[0]?.stats;
    if (!zero) throw new Error('no zero start');
    const title = `${player.profile}, team ${player.team.name}${player.team === NO_TEAM ? '' : ` (level ${player.level})`}`;
    console.log(`\n### ${title}`);
    console.log(
      '| start | runs | median height | median placed | median coins | mean coins | mean berries | mean s | coins/min | placed/min | (a) placed vs zero height | (b) median coins | (c) coins/min | (d) placed/min | coins/play min | placed/play min | (e) coins/play min | (f) placed/play min | berry start value/play min | ad start value/play min | (g) berry start vs zero | (h) ad start vs zero |',
    );
    console.log(
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    const zeroValue = valuePerPlayMin(zero, 0, 0);
    for (const { start, stats } of rows) {
      const label = (check: string): string => `${title}, start ${start}, (${check})`;
      let cells: string[];
      if (start === 0) {
        cells = Array.from({ length: 10 }, () => '-');
      } else {
        const berryValue = valuePerPlayMin(stats, checkpointBerryPrice(start), 0);
        const adValue = checkpointHasAd(start)
          ? valuePerPlayMin(stats, 0, SESSION_TIME.adSec)
          : null;
        const deltas: Array<[string, number]> = [
          ['a', deltaPct(stats.medPlaced, zero.medFull)],
          ['b', deltaPct(stats.medCoins, zero.medCoins)],
          ['c', deltaPct(stats.coinsPerMin, zero.coinsPerMin)],
          ['d', deltaPct(stats.layersPerMin, zero.layersPerMin)],
          ['e', deltaPct(stats.coinsPerPlayMin, zero.coinsPerPlayMin)],
          ['f', deltaPct(stats.layersPerPlayMin, zero.layersPerPlayMin)],
        ];
        cells = [
          ...deltas.map(([check, d]) => verdictOf(d, label(check))),
          berryValue.toFixed(1),
          adValue === null ? '-' : adValue.toFixed(1),
          verdictOf(deltaPct(berryValue, zeroValue), label('g')),
          adValue === null ? '-' : verdictOf(deltaPct(adValue, zeroValue), label('h')),
        ];
      }
      console.log(
        `| ${start} | ${stats.runs} | ${stats.medFull} | ${stats.medPlaced} | ${stats.medCoins} | ${stats.meanCoins.toFixed(1)} | ${stats.meanBerries.toFixed(2)} | ${stats.meanSeconds.toFixed(1)} | ${stats.coinsPerMin.toFixed(1)} | ${stats.layersPerMin.toFixed(1)} | ${stats.coinsPerPlayMin.toFixed(1)} | ${stats.layersPerPlayMin.toFixed(1)} | ${cells.join(' | ')} |`,
      );
    }
    if (player.team === NO_TEAM) {
      for (const h of CHECKPOINT_HEIGHTS) {
        const list = widths.widths[h];
        widthRows.push(
          `| ${player.profile} | ${h} | ${list.length} | ${list.length ? Math.round(medianOf(list)) : '-'} | ${CHECKPOINT_START_WIDTH[h]} |`,
        );
      }
    }
  }
  console.log('\n### Width of the layer at each checkpoint height, runs from zero, no team');
  console.log('| profile | height | runs reaching it | median width | CHECKPOINT_START_WIDTH |');
  console.log('|---|---|---|---|---|');
  widthRows.forEach((row) => console.log(row));
  console.log(
    `\nCheckpoint checks: ${failures.length ? `${failures.length} FAIL` : 'all ok'}${failures.length ? `\n${failures.map((f) => `  ${f}`).join('\n')}` : ''}`,
  );
}

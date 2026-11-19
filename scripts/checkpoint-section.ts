import { checkpointBerryPrice, checkpointHasAd } from '../src/core/zones/checkpoints';
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
import { mean, percentile, signedPct } from './sim-runner';

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

/**
 * Checks printed for reference only, not in the verdict (owner's decision 2026-11-19): (c) and (d)
 * count the run minute alone, and a start from a checkpoint is always faster there (the speed of
 * the curve at the start height). The verdict is the play minute and the start price, (e)-(h).
 */
const REFERENCE_CHECKS: ReadonlySet<string> = new Set(['c', 'd']);

/**
 * Accepted advantages of a checkpoint start, team none, keyed `<profile> <start> <check>` (owner's
 * decisions 2026-11-15 for the novice from 20 and 2026-11-19 for the novice from 40 and the regular
 * from 20: the start is paid with berries or an ad, so it is the player's choice). Each is the
 * value of the 2026-11-19 measure in percent; it prints for reference and fails again past that
 * value plus `ACCEPTED_DRIFT_PP`.
 */
const ACCEPTED: Readonly<Record<string, number>> = {
  'novice 20 b': 116.7,
  'novice 20 e': 82.7,
  'novice 20 h': 9.9,
  'novice 40 b': 100,
  'novice 40 e': 62.3,
  'regular 20 e': 14.4,
};
for (const key of Object.keys(ACCEPTED)) {
  const [profile, start] = key.split(' ');
  if (
    !SECTION_PLAYERS.some((p) => p.profile === profile) ||
    !START_HEIGHTS.some((h) => h === Number(start))
  ) {
    throw new Error(`accepted checkpoint advantage for an unknown player or start: ${key}`);
  }
}
/** How far past its accepted value an accepted advantage may drift before it fails again. */
const ACCEPTED_DRIFT_PP = 5;

/** Counts of the checks of a section: passed, printed for reference, failed. */
export interface CheckCounts {
  ok: number;
  reference: number;
  fail: number;
}

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
/**
 * Verdict of one check: `ok`, `fail` or `reference`; `acceptedKey` (`<profile> <start> <check>`)
 * finds an accepted advantage, `''` for none.
 */
export function judgeCheck(
  delta: number,
  check: string,
  acceptedKey: string,
): { kind: keyof CheckCounts; text: string } {
  if (REFERENCE_CHECKS.has(check))
    return { kind: 'reference', text: `${signedPct(delta)} reference` };
  const accepted = ACCEPTED[acceptedKey];
  if (accepted !== undefined && delta <= TOLERANCE_PP) {
    // The advantage is gone: the check passes, and the accepted entry is no longer needed.
    return { kind: 'ok', text: `${signedPct(delta)} ok (accepted entry no longer needed)` };
  }
  if (accepted !== undefined) {
    const limit = Number((accepted + ACCEPTED_DRIFT_PP).toFixed(1));
    return delta > limit
      ? { kind: 'fail', text: `${signedPct(delta)} FAIL (accepted up to ${signedPct(limit)})` }
      : {
          kind: 'reference',
          text: `${signedPct(delta)} reference (accepted, limit ${signedPct(limit)})`,
        };
  }
  return delta > TOLERANCE_PP
    ? { kind: 'fail', text: `${signedPct(delta)} FAIL` }
    : { kind: 'ok', text: `${signedPct(delta)} ok` };
}

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
export function printCheckpointSection(runs: number, profile: string | null): CheckCounts {
  const players = SECTION_PLAYERS.filter((p) => !profile || p.profile === profile);
  console.log(
    `\n## Checkpoint starts: ${runs} runs per profile, team and start height, same seeds for every start, continues: declined`,
  );
  console.log(
    'Duration is the sim clock of the run (placed layers only). A start from a checkpoint must not beat the run from zero by more than ' +
      `${TOLERANCE_PP} percentage points on (a) median placed layers vs median height from zero, (b) median coins per run, (c) coins per minute, (d) placed layers per minute; (e) and (f) are (c) and (d) per minute of play with the ${SESSION_TIME.resultsSec} s results screen after every run; (g) and (h) count the price of the start, with berries at the worst exchange rate (${COINS_PER_BERRY} coins per berry): value = mean coins + (mean berries earned - berry price) x rate, per minute of run + ${SESSION_TIME.resultsSec} s results; (g) a berry start, (h) an ad start (heights with an ad only: no berry price, + ${SESSION_TIME.adSec} s ad). Both are compared with the same value of the run from zero (its berries counted, no price). ` +
      `The verdict is (a), (b) and (e)-(h); (c) and (d) count the run minute alone and print for reference (owner's decision 2026-11-19). Accepted advantages print for reference with the limit past which they fail again (accepted value + ${ACCEPTED_DRIFT_PP} points): ${Object.entries(
        ACCEPTED,
      )
        .map(([key, value]) => `${key} ${signedPct(value)}`)
        .join(', ')}.`,
  );
  const widthRows: string[] = [];
  const failures: string[] = [];
  const references: string[] = [];
  const counts: CheckCounts = { ok: 0, reference: 0, fail: 0 };
  const verdictOf = (d: number, label: string, check: string, acceptedKey: string): string => {
    const { kind, text } = judgeCheck(d, check, acceptedKey);
    counts[kind]++;
    if (kind === 'fail') failures.push(`${label}: ${text}`);
    // Reference values over the tolerance are listed with their numbers, so a drift stays in sight.
    if ((kind === 'reference' && d > TOLERANCE_PP) || text.includes('no longer needed')) {
      references.push(`${label}: ${text}`);
    }
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
      const judge = (d: number, check: string): string =>
        verdictOf(
          d,
          label(check),
          check,
          player.team === NO_TEAM ? `${player.profile} ${start} ${check}` : '',
        );
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
          ...deltas.map(([check, d]) => judge(d, check)),
          berryValue.toFixed(1),
          adValue === null ? '-' : adValue.toFixed(1),
          judge(deltaPct(berryValue, zeroValue), 'g'),
          adValue === null ? '-' : judge(deltaPct(adValue, zeroValue), 'h'),
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
  const list = (lines: string[]): string => lines.map((line) => `\n  ${line}`).join('');
  console.log(
    `\nReference, not in the verdict ((c) and (d) over +${TOLERANCE_PP}%, accepted advantages): ${references.length}${list(references)}`,
  );
  console.log(
    `\nCheckpoint checks: ${counts.ok} ok, ${counts.reference} reference, ${counts.fail} FAIL${list(failures)}`,
  );
  return counts;
}

import { layerSpeed } from '../src/core/drop';
import type { SpeedScaleContext } from '../src/core/sim-types';
import { zoneStartIndex } from '../src/core/zones';
import { BALANCE, DIFFICULTY, type DifficultyTarget } from '../src/data/balance';
import { SAVE_DEFAULTS } from '../src/data/save-defaults';
import { NO_TEAM, type SimTeamSet } from '../src/data/sim-teams';
import { ZONES } from '../src/data/zones';
import { mean, percentile, playRun, profileStreams, teamSlots } from './sim-runner';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: { argv: string[] };

/**
 * `npm run sim:speed-variants`: what changes in height, coins and XP if the speed pacing is
 * tuned. The variants use the analysis hook `RunConfig.speedScale` (core/tower-sim.ts); no data
 * value is edited. Every cell plays the same seeds and bot noise, so variants are compared on
 * equal runs. XP is the height of the run.
 */

type SpeedScale = (context: SpeedScaleContext) => number;

interface Variant {
  name: string;
  /** A fresh scale function per run: the streak variant keeps state. */
  make: () => SpeedScale | undefined;
}

const LAST_ZONE_INDEX = ZONES.length - 1;

/** Tempo wave: the first layer of a zone (the kitchen excluded) is `drop` slower, back to nominal by the zone's last layer. */
const tempoWave =
  (drop: number): SpeedScale =>
  ({ index, zoneIndex }) => {
    if (zoneIndex === 0) return 1;
    const progress = Math.min(1, (index - zoneStartIndex(zoneIndex)) / (BALANCE.zones.length - 1));
    return 1 - drop * (1 - progress);
  };

/** Streak reward: after `needed` perfects in a row the next `layers` layers fly `slow` times as fast, a new reward at least `gap` layers after the last one started. */
const STREAK = { needed: 5, layers: 3, slow: 0.85, gap: 10 } as const;
function streakReward(): SpeedScale {
  let startedAt = -Infinity;
  let left = 0;
  return ({ index, combo }) => {
    if (left === 0 && combo >= STREAK.needed && index - startedAt >= STREAK.gap) {
      startedAt = index;
      left = STREAK.layers;
    }
    if (left === 0) return 1;
    left -= 1;
    return STREAK.slow;
  };
}

/** Space speed multiplier replaced by `mult`, same cap: the ratio of the new capped speed to the old one. */
const SPACE_MULT = 1.05;
const spaceMult: SpeedScale = ({ zoneIndex, height }) => {
  if (zoneIndex !== LAST_ZONE_INDEX) return 1;
  const zone = ZONES[LAST_ZONE_INDEX];
  const cap = zone?.speedCap ?? Infinity;
  const raw = layerSpeed(height, 1);
  return Math.min(cap, raw * SPACE_MULT) / Math.min(cap, raw * (zone?.speedMult ?? 1));
};

const VARIANTS: Variant[] = [
  { name: 'baseline', make: () => undefined },
  { name: 'wave -10%', make: () => tempoWave(0.1) },
  { name: 'wave -15%', make: () => tempoWave(0.15) },
  { name: 'streak reward', make: streakReward },
  { name: `space x${SPACE_MULT}`, make: () => spaceMult },
];

const PROFILE_IDS = ['strong', 'regular', 'expert'] as const;
const STARTER: SimTeamSet = { name: 'starter', creatures: SAVE_DEFAULTS.startCreatures };
const SETUPS: SimTeamSet[] = [NO_TEAM, STARTER];

interface Row {
  variant: string;
  median: number;
  p10: number;
  p90: number;
  'median vs base, %': string;
  'XP (mean height)': number;
  coins: number;
  'time, s': number;
}

function play(target: DifficultyTarget, set: SimTeamSet, variant: Variant, runs: number) {
  const { seeds, noise } = profileStreams(target.id);
  const team = teamSlots(set, SAVE_DEFAULTS.startCreatureLevel);
  return Array.from({ length: runs }, () => {
    const speedScale = variant.make();
    return playRun(
      { seed: seeds.int(0, 0xffffffff), mode: 'classic', team, tutorial: false, speedScale },
      target,
      noise,
    );
  });
}

const runsArg = process.argv.find((arg) => arg.startsWith('--runs='));
const runs = runsArg ? Number(runsArg.slice('--runs='.length)) : DIFFICULTY.runsPerProfile;
const MS_PER_SECOND = 1000;

console.log(
  `Speed pacing variants, ${runs} runs per cell, creature level ${SAVE_DEFAULTS.startCreatureLevel}; ` +
    `wave: zones 2-6 start slower and grow back to nominal by the zone's last layer (the kitchen is untouched); ` +
    `streak reward: after ${STREAK.needed} perfects in a row the next ${STREAK.layers} layers fly ${Math.round((1 - STREAK.slow) * 100)}% slower, ` +
    `a new reward starts at least ${STREAK.gap} layers after the previous one.`,
);
for (const id of PROFILE_IDS) {
  const target = DIFFICULTY.targets.find((t) => t.id === id) as DifficultyTarget;
  for (const set of SETUPS) {
    let baseMedian = 1;
    const rows: Row[] = VARIANTS.map((variant) => {
      const results = play(target, set, variant, runs);
      const heights = results.map((r) => r.height).sort((a, b) => a - b);
      const median = percentile(heights, 0.5);
      if (variant.name === 'baseline') baseMedian = median;
      return {
        variant: variant.name,
        median,
        p10: percentile(heights, 0.1),
        p90: percentile(heights, 0.9),
        'median vs base, %': (((median - baseMedian) / baseMedian) * 100).toFixed(1),
        'XP (mean height)': Number(mean(heights).toFixed(1)),
        coins: Number(mean(results.map((r) => r.coins)).toFixed(1)),
        'time, s': Number((mean(results.map((r) => r.durationMs)) / MS_PER_SECOND).toFixed(1)),
      };
    });
    console.log(
      `\nProfile ${id} (sd ${target.timingSdMs} ms), team: ${set.creatures.join('+') || 'none'}`,
    );
    console.table(rows);
  }
}

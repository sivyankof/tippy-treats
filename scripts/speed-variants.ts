import { layerSpeed } from '../src/core/drop';
import type { SpeedScaleContext } from '../src/core/sim-types';
import { zoneStartIndex } from '../src/core/zones';
import { BALANCE, DIFFICULTY, type DifficultyTarget } from '../src/data/balance';
import { SAVE_DEFAULTS } from '../src/data/save-defaults';
import { NO_TEAM, type SimTeamSet } from '../src/data/sim-teams';
import { ZONES } from '../src/data/zones';
import { MS_PER_SECOND } from '../src/util/math';
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
      [],
      ANALYSIS_MAX_HEIGHT,
    );
  });
}

const runs = intArg(scriptArgs(), 'runs', DIFFICULTY.runsPerProfile);

console.log(
  `Speed pacing variants, ${runs} runs per cell, creature level ${SAVE_DEFAULTS.startCreatureLevel}; ` +
    `wave: zones 2-6 start slower and grow back to nominal by the zone's last layer (the kitchen is untouched); ` +
    `the baseline already includes the streak reward of the game (BALANCE.tempoEase).`,
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

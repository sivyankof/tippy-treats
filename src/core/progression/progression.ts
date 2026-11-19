import {
  ALTERNATING_REWARDS,
  ENDLESS_FROM_LEVEL,
  ENDLESS_REWARD,
  LEVEL_REWARDS,
  XP_CURVE,
  type LevelReward,
} from '../../data/progression/progression';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const at = Math.max(1, Math.floor(level));
  return XP_CURVE.early[at - 1] ?? XP_CURVE.lateBase + XP_CURVE.lateStep * (at - 4);
}

export interface XpResult {
  level: number;
  xp: number;
  /** Every level reached by this gain, in order. */
  levelsGained: number[];
}

/** Adds XP and levels up as many times as needed. */
export function addXp(level: number, xp: number, gained: number): XpResult {
  let currentLevel = Math.max(1, Math.floor(level));
  let pool = Math.max(0, Math.floor(xp)) + Math.max(0, Math.floor(gained));
  const levelsGained: number[] = [];
  while (pool >= xpToNext(currentLevel)) {
    pool -= xpToNext(currentLevel);
    currentLevel += 1;
    levelsGained.push(currentLevel);
  }
  return { level: currentLevel, xp: pool, levelsGained };
}

/** Reward for reaching `level`; empty for level 1 and for any level without a reward. */
export function levelReward(level: number): LevelReward {
  const explicit = LEVEL_REWARDS[level];
  if (explicit) return explicit;
  if (level >= ALTERNATING_REWARDS.from && level <= ALTERNATING_REWARDS.to) {
    return level % 2 === 1 ? ALTERNATING_REWARDS.odd : ALTERNATING_REWARDS.even;
  }
  if (level >= ENDLESS_FROM_LEVEL) return ENDLESS_REWARD;
  return {};
}

/** Layers placed in the run (a run from a checkpoint does not count the start height); XP comes from them through the oven (`core/economy/oven.ts`). */
export function runLayers(height: number, startHeight = 0): number {
  return Math.max(0, Math.floor(height) - Math.floor(startHeight));
}

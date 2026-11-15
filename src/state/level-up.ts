// Baker XP and the level rewards it pays, as a pure function over the save.
import { earn, grantCreature, type Cost } from '../core/economy';
import { addXp, levelReward } from '../core/progression';
import type { Save } from '../core/save/schema';
import type { LevelReward } from '../data/progression';

/** One level reached by a gain of XP, with what it paid. */
export interface LevelUp {
  level: number;
  reward: LevelReward;
  /** The reward creature was already owned: what was paid instead of it. */
  duplicate: Cost | null;
}

/** Coins and berries of a level reward, and the creature it hands over (or its compensation). */
function applyLevelReward(
  save: Save,
  reward: LevelReward,
): { value: Save; duplicate: Cost | null } {
  const paid = earn(save, { coins: reward.coins, berries: reward.berries });
  if (reward.creature === undefined) return { value: paid, duplicate: null };
  return grantCreature(paid, reward.creature);
}

/** The save with `gained` XP added, every level it reaches and the rewards of those levels. */
export function withXp(save: Save, gained: number): { save: Save; levelUps: LevelUp[] } {
  const progress = addXp(save.bakerLevel, save.bakerXp, gained);
  let next: Save = { ...save, bakerLevel: progress.level, bakerXp: progress.xp };
  const levelUps: LevelUp[] = [];
  for (const level of progress.levelsGained) {
    const reward = levelReward(level);
    const applied = applyLevelReward(next, reward);
    next = applied.value;
    levelUps.push({ level, reward, duplicate: applied.duplicate });
  }
  return { save: next, levelUps };
}

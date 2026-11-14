import type { CreatureId } from './creatures';

/** Highest baker level a save may hold; a larger number in a stored text is a damaged or edited one. */
export const MAX_BAKER_LEVEL = 1000;

/** Baker XP needed to leave a level: `base + step * (level - 1)` (docs/04-meta-retention.md, section 1). */
export const XP_TO_NEXT = { base: 40, step: 25 } as const;

export interface LevelReward {
  /** Creature handed over for free. */
  creature?: CreatureId;
  /** The third team slot opens. */
  thirdTeamSlot?: boolean;
  /** The creature becomes available in the shop. */
  shopUnlock?: CreatureId;
  /** The daily tower opens. */
  dailyTower?: boolean;
  coins?: number;
  berries?: number;
}

export const LEVEL_REWARDS: Readonly<Record<number, LevelReward>> = {
  2: { creature: 'puff' },
  3: { thirdTeamSlot: true },
  4: { shopUnlock: 'frosty', coins: 100 },
  5: { dailyTower: true, berries: 10 },
  6: { shopUnlock: 'sprinkle', coins: 150 },
  7: { berries: 15 },
  8: { shopUnlock: 'crumb', coins: 200 },
  9: { berries: 20 },
  10: { shopUnlock: 'ghost', coins: 300 },
  11: { berries: 20 },
  12: { shopUnlock: 'lemon', coins: 300 },
  20: { creature: 'rainbow' },
};

/** Levels 13..19 alternate: odd levels give berries, even levels give coins. */
export const ALTERNATING_REWARDS = {
  from: 13,
  to: 19,
  odd: { berries: 25 } as LevelReward,
  even: { coins: 400 } as LevelReward,
};

/** Every level above the last explicit one gives this, endlessly. */
export const ENDLESS_REWARD: LevelReward = { coins: 200 };
export const ENDLESS_FROM_LEVEL = 21;

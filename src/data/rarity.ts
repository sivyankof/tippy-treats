import { PALETTE } from './palette';

/** Creature and ability rarity tiers, from the most common to the rarest (docs/03-creatures.md). */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export type Rarity = (typeof RARITIES)[number];

/** Frame and effect colour per rarity: green, blue, purple, gold (docs/03-creatures.md). */
export const RARITY_COLORS: Readonly<Record<Rarity, number>> = {
  common: PALETTE.success,
  rare: 0x4aa8ff,
  epic: PALETTE.accentSecondary,
  legendary: PALETTE.gold,
};

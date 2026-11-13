/** Creature and ability rarity tiers, from the most common to the rarest (docs/03-creatures.md). */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export type Rarity = (typeof RARITIES)[number];

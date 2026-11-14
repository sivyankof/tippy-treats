/** Price of the upgrade from level n to n + 1, index 0 is level 1 -> 2 (docs/05-economy-monetization.md, section 4). */
export const UPGRADE_COSTS: readonly number[] = [150, 400, 900, 2000];

export interface BerryPack {
  berries: number;
  coins: number;
}

/** Berries -> coins exchange packs. */
export const BERRY_PACKS: readonly BerryPack[] = [
  { berries: 10, coins: 100 },
  { berries: 50, coins: 600 },
  { berries: 100, coins: 1400 },
];

/**
 * A creature reward the player already owns pays this share of its shop price instead, in the
 * currency it sells for, coins first (docs/03-creatures.md, "Получение существ"). The starter
 * pack has its own rule (docs/05-economy-monetization.md, section 5).
 */
export const DUPLICATE_CREATURE_SHARE = 0.5;

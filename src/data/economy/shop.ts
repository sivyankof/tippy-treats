import type { CreatureId } from '../creatures/creatures';

/**
 * The purchases of the game by a logical key (docs/05-economy-monetization.md, section 5). The
 * store identifiers are not here: they come from `.env` (`services/iap/product-ids.ts`).
 */
export const PRODUCT_KEYS = [
  'remove_ads',
  'starter_pack',
  'berries_80',
  'berries_500',
  'berries_1200',
  'berries_2800',
] as const;

export type ProductKey = (typeof PRODUCT_KEYS)[number];

export function isProductKey(value: string): value is ProductKey {
  return (PRODUCT_KEYS as readonly string[]).includes(value);
}

/** What a purchase gives. */
export interface ProductGrant {
  berries?: number;
  coins?: number;
  /** The "remove ads" switch. */
  removeAds?: boolean;
  /** A creature; `duplicateCoins` come instead of it when the player already owns it. */
  creature?: CreatureId;
  duplicateCoins?: number;
}

/** Shop badge on a berry pack. */
export type PackBadge = 'popular' | 'best_value';

export interface ProductDef {
  /** A non-consumable is bought once and restored; a consumable can be bought again and again. */
  kind: 'consumable' | 'non_consumable';
  grant: ProductGrant;
  badge?: PackBadge;
}

export const PRODUCTS: Record<ProductKey, ProductDef> = {
  remove_ads: { kind: 'non_consumable', grant: { removeAds: true } },
  starter_pack: {
    kind: 'non_consumable',
    grant: { creature: 'crumb', duplicateCoins: 1200, coins: 500, berries: 60 },
  },
  berries_80: { kind: 'consumable', grant: { berries: 80 } },
  berries_500: { kind: 'consumable', grant: { berries: 500 }, badge: 'popular' },
  berries_1200: { kind: 'consumable', grant: { berries: 1200 } },
  berries_2800: { kind: 'consumable', grant: { berries: 2800 }, badge: 'best_value' },
};

/** The berry packs in the order of the shop list. */
export const BERRY_PRODUCTS: readonly ProductKey[] = [
  'berries_80',
  'berries_500',
  'berries_1200',
  'berries_2800',
];

/** Numbers of the shop rules (docs/05-economy-monetization.md, sections 5 and 6). */
export const SHOP = {
  /** The starter pack is offered this many days after its first show on Home, or until it is bought. */
  starterPackDays: 7,
  /** Free coins for a rewarded ad. */
  freeCoins: { amount: 25, perDay: 3 },
} as const;

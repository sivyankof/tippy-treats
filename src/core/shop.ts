// The shop as pure rules over the save (docs/05-economy-monetization.md, sections 4-6): the
// starter pack, the free coins for an ad, the creatures sold for coins and what a purchase gives.
import { CREATURE_IDS, type CreatureId } from '../data/creatures';
import { MS_PER_DAY } from '../data/clock';
import { PRODUCTS, SHOP, type ProductKey } from '../data/shop';
import { creaturePrice, earn } from './economy';
import { pastQuietRuns } from './first-runs';
import type { Save } from './save/schema';

/**
 * When the starter pack stops being offered: `shop.starterPackUntil` when set, else a week after
 * its first show on Home; null while the window has not started (Home has not shown it yet).
 */
export function starterPackEnd(save: Pick<Save, 'shop'>): number | null {
  const { starterPackUntil, starterPackShownAt } = save.shop;
  if (starterPackUntil > 0) return starterPackUntil;
  return starterPackShownAt > 0 ? starterPackShownAt + SHOP.starterPackDays * MS_PER_DAY : null;
}

/** The shop offers the pack until it is bought or its window is over, whatever the run count. */
export function starterPackInShop(save: Pick<Save, 'shop' | 'purchases'>, nowMs: number): boolean {
  const end = starterPackEnd(save);
  return !save.purchases.starterPack && (end === null || nowMs < end);
}

/** Home offers the pack only once the first runs are over, and then like the shop does. */
export function starterPackOnHome(
  save: Pick<Save, 'shop' | 'purchases' | 'stats'>,
  nowMs: number,
): boolean {
  return pastQuietRuns(save.stats.runs) && starterPackInShop(save, nowMs);
}

/** Milliseconds left of the offer, 0 once it is over; null while the window has not started. */
export function starterPackMsLeft(save: Pick<Save, 'shop'>, nowMs: number): number | null {
  const end = starterPackEnd(save);
  return end === null ? null : Math.max(0, end - nowMs);
}

/** The save with the first show of the pack on Home kept; the same save when it was kept before. */
export function withStarterPackShown(save: Save, nowMs: number): Save {
  if (save.shop.starterPackShownAt > 0) return save;
  return { ...save, shop: { ...save.shop, starterPackShownAt: nowMs } };
}

export interface StarterPackContents {
  /** The creature the pack gives; null when the player owns it already. */
  creature: CreatureId | null;
  coins: number;
  berries: number;
}

/** What the pack gives this player: the creature, or its coin replacement when it is owned. */
export function starterPackContents(creatures: Save['creatures']): StarterPackContents {
  const { creature, coins = 0, berries = 0, duplicateCoins = 0 } = PRODUCTS.starter_pack.grant;
  const owned = creature !== undefined && creatures[creature] !== undefined;
  return {
    creature: creature === undefined || owned ? null : creature,
    coins: coins + (owned ? duplicateCoins : 0),
    berries,
  };
}

/** Free-coin ads left today; a new local day starts the count over. */
export function freeCoinsLeft(shop: Save['shop'], today: string): number {
  const used = shop.freeCoinsDay === today ? shop.freeCoinsUsed : 0;
  return Math.max(0, SHOP.freeCoins.perDay - used);
}

/** The save with one free-coin ad paid out; null when today's ads are used up. Pay it only after the ad was watched. */
export function withFreeCoinsClaimed(save: Save, today: string): Save | null {
  const left = freeCoinsLeft(save.shop, today);
  if (left <= 0) return null;
  const used = SHOP.freeCoins.perDay - left + 1;
  return {
    ...earn(save, { coins: SHOP.freeCoins.amount }),
    shop: { ...save.shop, freeCoinsDay: today, freeCoinsUsed: used },
  };
}

/** The unowned creatures the shop sells for coins at this baker level, cheapest first. */
export function shopCreatures(
  save: Pick<Save, 'bakerLevel' | 'creatures'>,
): Array<{ id: CreatureId; price: number }> {
  const list: Array<{ id: CreatureId; price: number }> = [];
  for (const id of CREATURE_IDS) {
    if (save.creatures[id] !== undefined) continue;
    const price = creaturePrice(id, save.bakerLevel).find((option) => option.currency === 'coins');
    if (price) list.push({ id, price: price.price });
  }
  return list.sort((a, b) => a.price - b.price);
}

/** A creature of the shop can be bought for coins right now (the red dot on Shop). */
export function coinCreatureAffordable(
  save: Pick<Save, 'bakerLevel' | 'creatures' | 'coins'>,
): boolean {
  return shopCreatures(save).some((entry) => entry.price <= save.coins);
}

/** True when a one-time product is already in the save. */
export function productOwned(save: Pick<Save, 'purchases'>, key: ProductKey): boolean {
  if (key === 'remove_ads') return save.purchases.removeAds;
  if (key === 'starter_pack') return save.purchases.starterPack;
  return false;
}

/**
 * The save with a confirmed purchase paid out; null for a one-time product that was already
 * given (a purchase is granted once). Call it only after the store said `purchased`.
 */
export function withProductGranted(save: Save, key: ProductKey): Save | null {
  if (productOwned(save, key)) return null;
  const { grant } = PRODUCTS[key];
  let next: Save = save;
  if (grant.creature !== undefined) {
    const contents = starterPackContents(save.creatures);
    next = { ...next, purchases: { ...next.purchases, starterPack: true } };
    if (contents.creature !== null) {
      next = { ...next, creatures: { ...next.creatures, [contents.creature]: { level: 1 } } };
    }
    return earn(next, { coins: contents.coins, berries: contents.berries });
  }
  if (grant.removeAds) next = { ...next, purchases: { ...next.purchases, removeAds: true } };
  return earn(next, { coins: grant.coins, berries: grant.berries });
}

/**
 * Brings the save in line with what the store says is owned (at launch and on "Restore
 * purchases"). Only what lasts is restored: the switch of "remove ads", the end of the starter
 * offer and the creature of the pack; its coins and berries were spent once and do not come back.
 * The same save is returned when nothing changes.
 */
export function withPurchasesRestored(save: Save, owned: readonly ProductKey[]): Save {
  let next = save;
  if (owned.includes('remove_ads') && !next.purchases.removeAds) {
    next = { ...next, purchases: { ...next.purchases, removeAds: true } };
  }
  if (owned.includes('starter_pack') && !next.purchases.starterPack) {
    const { creature } = PRODUCTS.starter_pack.grant;
    next = { ...next, purchases: { ...next.purchases, starterPack: true } };
    if (creature !== undefined && next.creatures[creature] === undefined) {
      next = { ...next, creatures: { ...next.creatures, [creature]: { level: 1 } } };
    }
  }
  return next;
}

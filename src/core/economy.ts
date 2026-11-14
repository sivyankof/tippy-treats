import { CREATURES, MAX_CREATURE_LEVEL, type CreatureId } from '../data/creatures';
import { BERRY_PACKS, DUPLICATE_CREATURE_SHARE, UPGRADE_COSTS } from '../data/economy';

export interface Wallet {
  coins: number;
  berries: number;
}

export type Currency = keyof Wallet;

export interface Cost {
  coins?: number;
  berries?: number;
}

/** The part of the save the economy works on. */
export interface EconomySlice extends Wallet {
  bakerLevel: number;
  creatures: Partial<Record<CreatureId, { level: number }>>;
}

export type EconomyResult<T, R extends string> = { ok: true; value: T } | { ok: false; reason: R };

export interface PriceOption {
  currency: Currency;
  price: number;
}

/** A gain as a whole number, never negative: NaN, infinity and negatives count as zero. */
function gainAmount(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** A price as a whole number (a fraction rounds up); null for a negative or non-finite one. */
function costAmount(value: number | undefined): number | null {
  if (value === undefined) return 0;
  return Number.isFinite(value) && value >= 0 ? Math.ceil(value) : null;
}

export function canAfford(wallet: Wallet, cost: Cost): boolean {
  const coins = costAmount(cost.coins);
  const berries = costAmount(cost.berries);
  if (coins === null || berries === null) return false;
  return wallet.coins >= coins && wallet.berries >= berries;
}

/** The wallet after paying, or null when it is not enough or the cost is invalid: a balance never goes below zero. */
export function spend<W extends Wallet>(wallet: W, cost: Cost): W | null {
  if (!canAfford(wallet, cost)) return null;
  return {
    ...wallet,
    coins: wallet.coins - (costAmount(cost.coins) ?? 0),
    berries: wallet.berries - (costAmount(cost.berries) ?? 0),
  };
}

export function earn<W extends Wallet>(wallet: W, gain: Cost): W {
  return {
    ...wallet,
    coins: wallet.coins + gainAmount(gain.coins),
    berries: wallet.berries + gainAmount(gain.berries),
  };
}

/** Every shop entry of a creature with the baker level it needs. */
function shopEntries(id: CreatureId): Array<PriceOption & { minBakerLevel: number }> {
  const entries: Array<PriceOption & { minBakerLevel: number }> = [];
  for (const unlock of CREATURES[id].unlock) {
    if (unlock.kind !== 'shop') continue;
    const minBakerLevel = unlock.minBakerLevel ?? 1;
    if (unlock.coins !== undefined) {
      entries.push({ currency: 'coins', price: unlock.coins, minBakerLevel });
    }
    if (unlock.berries !== undefined) {
      entries.push({ currency: 'berries', price: unlock.berries, minBakerLevel });
    }
  }
  return entries;
}

/** Prices the player can pay right now with the baker level he has; empty when the shop does not sell it yet. */
export function creaturePrice(id: CreatureId, bakerLevel: number): PriceOption[] {
  return shopEntries(id)
    .filter((entry) => bakerLevel >= entry.minBakerLevel)
    .map(({ currency, price }) => ({ currency, price }));
}

/**
 * What a creature reward pays when the player already owns the creature: half its shop price in
 * the currency it sells for, coins when it sells for both. Empty for a creature the shop never sells.
 */
export function duplicateCompensation(id: CreatureId): Cost {
  const entries = shopEntries(id);
  const entry = entries.find((option) => option.currency === 'coins') ?? entries[0];
  if (!entry) return {};
  return { [entry.currency]: Math.floor(entry.price * DUPLICATE_CREATURE_SHARE) };
}

/** The part of the save a creature reward changes. */
export type CreatureHolder = Wallet & Pick<EconomySlice, 'creatures'>;

export interface CreatureGrant<S extends CreatureHolder> {
  value: S;
  /** Set when the creature was already owned: what was paid instead of it. */
  duplicate: Cost | null;
}

/** Hands over a creature reward at level 1, or its compensation when it is already owned. */
export function grantCreature<S extends CreatureHolder>(
  slice: S,
  id: CreatureId,
): CreatureGrant<S> {
  if (slice.creatures[id] === undefined) {
    return {
      value: { ...slice, creatures: { ...slice.creatures, [id]: { level: 1 } } },
      duplicate: null,
    };
  }
  const duplicate = duplicateCompensation(id);
  return { value: earn(slice, duplicate), duplicate };
}

export type BuyError = 'owned' | 'locked' | 'not_enough';

export function buyCreature(
  slice: EconomySlice,
  id: CreatureId,
  currency: Currency,
): EconomyResult<EconomySlice, BuyError> {
  if (slice.creatures[id] !== undefined) return { ok: false, reason: 'owned' };
  const option = creaturePrice(id, slice.bakerLevel).find((entry) => entry.currency === currency);
  if (!option) return { ok: false, reason: 'locked' };
  const paid = spend(slice, { [currency]: option.price });
  if (!paid) return { ok: false, reason: 'not_enough' };
  return { ok: true, value: { ...paid, creatures: { ...paid.creatures, [id]: { level: 1 } } } };
}

/** Coins for the upgrade from `level` to `level + 1`; null at the maximum level. */
export function upgradeCost(level: number): number | null {
  if (level >= MAX_CREATURE_LEVEL) return null;
  return UPGRADE_COSTS[Math.max(1, Math.floor(level)) - 1] ?? null;
}

export type UpgradeError = 'not_owned' | 'max_level' | 'not_enough';

export function upgradeCreature(
  slice: EconomySlice,
  id: CreatureId,
): EconomyResult<EconomySlice, UpgradeError> {
  const owned = slice.creatures[id];
  if (!owned) return { ok: false, reason: 'not_owned' };
  const cost = upgradeCost(owned.level);
  if (cost === null) return { ok: false, reason: 'max_level' };
  const paid = spend(slice, { coins: cost });
  if (!paid) return { ok: false, reason: 'not_enough' };
  return {
    ok: true,
    value: { ...paid, creatures: { ...paid.creatures, [id]: { level: owned.level + 1 } } },
  };
}

export type ExchangeError = 'unknown_pack' | 'not_enough';

/** Swaps one pack (`berries` is the pack size: 10, 50 or 100) for coins. */
export function exchangeBerries(
  slice: EconomySlice,
  berries: number,
): EconomyResult<EconomySlice, ExchangeError> {
  const pack = BERRY_PACKS.find((entry) => entry.berries === berries);
  if (!pack) return { ok: false, reason: 'unknown_pack' };
  const paid = spend(slice, { berries: pack.berries });
  if (!paid) return { ok: false, reason: 'not_enough' };
  return { ok: true, value: earn(paid, { coins: pack.coins }) };
}

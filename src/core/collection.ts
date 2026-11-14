import { CREATURE_IDS, CREATURES, type CreatureId } from '../data/creatures';
import type { Currency } from './economy';
import type { OwnedCreatures } from './team';

/** How a locked creature is obtained, as its collection card shows it. */
export type UnlockHint =
  | { kind: 'shop'; currency: Currency; price: number; minBakerLevel: number }
  | { kind: 'bakerLevel'; level: number }
  | { kind: 'streak'; day: number }
  | { kind: 'record'; height: number }
  | { kind: 'starterPack' }
  | { kind: 'tutorial' };

/**
 * The way to show for a locked creature: the shop price when the shop sells it (coins first),
 * otherwise its first free way. The starter pack is never shown when another way exists.
 */
export function unlockHint(id: CreatureId): UnlockHint {
  const unlocks = CREATURES[id].unlock;
  for (const currency of ['coins', 'berries'] as const) {
    for (const unlock of unlocks) {
      if (unlock.kind !== 'shop') continue;
      const price = unlock[currency];
      if (price !== undefined) {
        return { kind: 'shop', currency, price, minBakerLevel: unlock.minBakerLevel ?? 1 };
      }
    }
  }
  for (const unlock of unlocks) {
    if (unlock.kind === 'bakerLevel') return { kind: 'bakerLevel', level: unlock.level };
    if (unlock.kind === 'streak') return { kind: 'streak', day: unlock.day };
    if (unlock.kind === 'record') return { kind: 'record', height: unlock.height };
  }
  return unlocks.some((unlock) => unlock.kind === 'tutorial')
    ? { kind: 'tutorial' }
    : { kind: 'starterPack' };
}

/** Owned and total creature count for the "7 / 12" line. */
export function collectionCount(owned: OwnedCreatures): { owned: number; total: number } {
  return {
    owned: CREATURE_IDS.filter((id) => owned[id] !== undefined).length,
    total: CREATURE_IDS.length,
  };
}

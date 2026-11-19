import { CREATURE_IDS, CREATURES, type CreatureId } from '../data/creatures/creatures';
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

/**
 * Every way a locked creature can be obtained, as its cards show them: the free ways first
 * (baker level, streak, record), then the shop price (coins first, as `unlockHint`). One entry for
 * a creature with a single way. The starter pack and the tutorial are not shown next to others.
 */
export function unlockHints(id: CreatureId): UnlockHint[] {
  const primary = unlockHint(id);
  const hints: UnlockHint[] = [];
  for (const unlock of CREATURES[id].unlock) {
    if (unlock.kind === 'bakerLevel') hints.push({ kind: 'bakerLevel', level: unlock.level });
    if (unlock.kind === 'streak') hints.push({ kind: 'streak', day: unlock.day });
    if (unlock.kind === 'record') hints.push({ kind: 'record', height: unlock.height });
  }
  if (primary.kind === 'shop') hints.push(primary);
  return hints.length > 0 ? hints : [primary];
}

/** Owned and total creature count for the "7 / 12" line. */
export function collectionCount(owned: OwnedCreatures): { owned: number; total: number } {
  return {
    owned: CREATURE_IDS.filter((id) => owned[id] !== undefined).length,
    total: CREATURE_IDS.length,
  };
}

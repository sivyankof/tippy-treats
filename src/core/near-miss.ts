import { CREATURE_IDS, type CreatureId } from '../data/creatures';
import { NEAR_MISS } from '../data/progression';
import { creaturePrice } from './economy';
import { xpToNext } from './progression';
import type { OwnedCreatures } from './team';

/** What the player has right after the run was recorded. */
export interface NearMissInput {
  height: number;
  /** Best classic height before this run; `null` when there was none (the first run). */
  previousRecord: number | null;
  bakerLevel: number;
  bakerXp: number;
  coins: number;
  owned: OwnedCreatures;
}

/** The closest goal the run fell short of (docs/04-meta-retention.md, section 6). */
export type NearMiss =
  | { kind: 'record'; layers: number }
  | { kind: 'xp'; xp: number; level: number }
  | { kind: 'coins'; coins: number; creature: CreatureId }
  | { kind: 'best'; record: number };

/**
 * The first goal that fits: the record a few layers away, the next baker level a little XP
 * away, a creature for coins a few coins away; otherwise the personal record. The goal "a
 * mission is nearly done" joins the list with the missions.
 */
export function nearMiss(input: NearMissInput): NearMiss {
  const { previousRecord, height } = input;
  if (previousRecord !== null) {
    const layers = previousRecord - height;
    if (layers > 0 && layers <= NEAR_MISS.recordLayers) return { kind: 'record', layers };
  }
  const xp = xpToNext(input.bakerLevel) - input.bakerXp;
  if (xp > 0 && xp <= NEAR_MISS.xp) return { kind: 'xp', xp, level: input.bakerLevel + 1 };
  const creature = nearestCoinCreature(input);
  if (creature && creature.coins <= NEAR_MISS.coins) return { kind: 'coins', ...creature };
  return { kind: 'best', record: Math.max(previousRecord ?? 0, height) };
}

/** The unowned creature the shop sells for coins right now that is the fewest coins away. */
function nearestCoinCreature(input: NearMissInput): { coins: number; creature: CreatureId } | null {
  let best: { coins: number; creature: CreatureId } | null = null;
  for (const id of CREATURE_IDS) {
    if (input.owned[id] !== undefined) continue;
    const price = creaturePrice(id, input.bakerLevel).find((p) => p.currency === 'coins');
    if (!price || price.price <= input.coins) continue;
    const coins = price.price - input.coins;
    if (!best || coins < best.coins) best = { coins, creature: id };
  }
  return best;
}

import { CREATURES, CREATURE_IDS, type CreatureId } from '../data/creatures';

/** A creature that the best classic height hands over for free. */
export interface RecordUnlock {
  id: CreatureId;
  height: number;
}

/** Every record way of the creatures, in the order of the creature list. */
export const RECORD_UNLOCKS: readonly RecordUnlock[] = CREATURE_IDS.flatMap((id) =>
  CREATURES[id].unlock.flatMap((unlock) =>
    unlock.kind === 'record' ? [{ id, height: unlock.height }] : [],
  ),
);

/** Creatures not owned yet whose record way `height` already reached (each once, in list order). */
export function recordCreaturesReached(
  height: number,
  isOwned: (id: CreatureId) => boolean,
  unlocks: readonly RecordUnlock[] = RECORD_UNLOCKS,
): CreatureId[] {
  const reached: CreatureId[] = [];
  for (const unlock of unlocks) {
    if (height >= unlock.height && !isOwned(unlock.id) && !reached.includes(unlock.id)) {
      reached.push(unlock.id);
    }
  }
  return reached;
}

// Dev-only level grants as pure functions over the save (debug panel buttons).
import type { Save } from '../core/save/schema';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../data/creatures';
import { MAX_BAKER_LEVEL } from '../data/progression';

/** The save one baker level higher (capped), XP in the level reset, no level reward granted. */
export function withBakerLevelBumped(save: Save): Save {
  return { ...save, bakerLevel: Math.min(MAX_BAKER_LEVEL, save.bakerLevel + 1), bakerXp: 0 };
}

/** The save with every creature one level higher up to the cap; a creature not owned yet becomes level 1. */
export function withCreaturesBumped(save: Save): Save {
  const creatures: Save['creatures'] = { ...save.creatures };
  for (const id of CREATURE_IDS) {
    const owned = creatures[id];
    creatures[id] = { level: owned ? Math.min(MAX_CREATURE_LEVEL, owned.level + 1) : 1 };
  }
  return { ...save, creatures };
}

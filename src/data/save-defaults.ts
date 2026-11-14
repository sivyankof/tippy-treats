import type { CreatureId } from './creatures';

/** Starting state of a fresh save (docs/08-architecture.md, section 5). */
export const SAVE_DEFAULTS = {
  /** Creatures owned from the first launch (honey is the tutorial creature). */
  startCreatures: ['honey'] as readonly CreatureId[],
  startCreatureLevel: 1,
  bakerLevel: 1,
  bakerXp: 0,
  coins: 0,
  berries: 0,
} as const;

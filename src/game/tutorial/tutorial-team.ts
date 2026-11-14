import type { TeamSlot } from '../../core/sim-types';

/** The team of the tutorial run: the starter creature alone in the first slot. */
export const TUTORIAL_TEAM: readonly (TeamSlot | null)[] = [{ id: 'honey', level: 1 }, null, null];

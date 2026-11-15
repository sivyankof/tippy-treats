// Numbers of the game as they were when save version 5 was introduced. The 4 -> 5 migration reads
// these instead of the live data, so retuning the game later never changes what that step does.
import type { RecordUnlock } from '../record-unlocks';

/** Baker XP to leave a level before save version 5: `base + step * (level - 1)`. */
export function legacyXpToNext(level: number): number {
  return 40 + 25 * (Math.max(1, Math.floor(level)) - 1);
}

/** Baker XP to leave a level on the curve of save version 5 (levels 1..4 fixed, then linear). */
export function v5XpToNext(level: number): number {
  const at = Math.max(1, Math.floor(level));
  return [150, 250, 400, 600][at - 1] ?? 100 + 810 * (at - 4);
}

/** Creatures with a record way as of save version 5. */
export const V5_RECORD_UNLOCKS: readonly RecordUnlock[] = [{ id: 'twins', height: 75 }];

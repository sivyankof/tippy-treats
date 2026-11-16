// Numbers of the game as they were when save version 8 was introduced. The 7 -> 8 migration reads
// these instead of the live data, so retuning the zones later never changes what that step does.

/** First layer of Space as of save version 8. */
export const V8_SPACE_FIRST_LAYER = 101;

/** Layers in one lap of Space as of save version 8. */
export const V8_LAP_LENGTH = 20;

/** The Space lap a tower of this height reaches (0 below Space), by the version 8 rules. */
export function v8LapReached(height: number): number {
  if (!Number.isFinite(height) || height < V8_SPACE_FIRST_LAYER) return 0;
  return Math.floor((Math.floor(height) - V8_SPACE_FIRST_LAYER) / V8_LAP_LENGTH) + 1;
}

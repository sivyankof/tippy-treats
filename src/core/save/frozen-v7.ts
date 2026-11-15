// Numbers of the game as they were when save version 7 was introduced. The 6 -> 7 migration reads
// these instead of the live data, so retuning the checkpoints later never changes what that step does.

/** Checkpoint heights as of save version 7, lowest first. */
export const V7_CHECKPOINT_HEIGHTS: readonly number[] = [20, 40, 60, 80, 100];

/** Heights of the version 7 checkpoints that a classic tower of this height has reached. */
export function v7CheckpointsReached(height: number): number[] {
  return V7_CHECKPOINT_HEIGHTS.filter((h) => h <= Math.floor(height));
}

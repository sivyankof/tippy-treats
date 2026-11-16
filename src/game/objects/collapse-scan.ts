/**
 * The topmost index below `floor` (searching downwards) that has no picture yet, or -1 when every
 * one has. `baked(i)` says whether the layer `i` has its picture.
 */
export function nextUnbaked(floor: number, baked: (index: number) => boolean): number {
  for (let i = floor - 1; i >= 0; i--) {
    if (!baked(i)) return i;
  }
  return -1;
}

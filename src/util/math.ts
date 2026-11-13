/** One full turn in radians. */
export const TWO_PI = Math.PI * 2;

/** Number of distinct uint32 values: the domain of run seeds. */
export const UINT32_RANGE = 0x1_0000_0000;

/** Random run seed in the uint32 domain. Not for use inside src/core. */
export function randomSeed(source: () => number = Math.random): number {
  return Math.floor(source() * UINT32_RANGE);
}

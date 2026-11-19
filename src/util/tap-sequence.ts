/**
 * Counts taps that follow each other closely: `tap()` is true on the tap that completes `count`
 * taps, all within `windowMs` of the first one counted. The clock is passed in for tests.
 */
export function createTapSequence(
  count: number,
  windowMs: number,
  now: () => number = () => performance.now(),
): { tap: () => boolean } {
  let stamps: number[] = [];
  return {
    tap(): boolean {
      const at = now();
      stamps = stamps.filter((stamp) => at - stamp <= windowMs);
      stamps.push(at);
      if (stamps.length < count) return false;
      stamps = [];
      return true;
    },
  };
}

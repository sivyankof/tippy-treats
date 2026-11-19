/** How many letters of a text are visible after `elapsedMs`, one every `letterMs`. */
export function lettersShown(total: number, elapsedMs: number, letterMs: number): number {
  if (total <= 0) return 0;
  if (letterMs <= 0) return total;
  return Math.min(total, Math.max(0, Math.floor(elapsedMs / letterMs)));
}

/**
 * Splits a count of visible letters over several lines of text that appear one after
 * another: the first line fills up before the second one starts.
 */
export function splitLetters(lengths: readonly number[], shown: number): number[] {
  let left = Math.max(0, shown);
  return lengths.map((len) => {
    const n = Math.min(len, left);
    left -= n;
    return n;
  });
}

/** Wave of the shaking box: the swing grows from nothing to the full angle. */
export function shakeAngle(progress: number, waves: number, maxDeg: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin(p * waves * Math.PI) * maxDeg * p;
}

/** Why the music is turned down: a window is open, or the record fanfare plays. */
export type DuckReason = 'window' | 'record';

/**
 * Multiplier of the music level for the reasons that hold now: 1 when none holds, otherwise
 * `1 - share` (reasons do not stack: two windows and a fanfare duck by the same share).
 */
export function duckFactor(held: ReadonlySet<DuckReason>, share: number): number {
  return held.size > 0 ? 1 - share : 1;
}

/** Target gain of the music bus: 0 when music is off, else its level times the duck factor. */
export function musicTarget(
  on: boolean,
  level: number,
  held: ReadonlySet<DuckReason>,
  share: number,
): number {
  return on ? level * duckFactor(held, share) : 0;
}

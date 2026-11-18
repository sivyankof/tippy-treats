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

/** The music is heard: a tune is playing, the switch is on and the music level is not turned to zero. */
export function musicAudible(tunePlaying: boolean, on: boolean, levelScale: number): boolean {
  return tunePlaying && on && levelScale > 0;
}

/**
 * Transfer curve of the output limiter, `size` points over input -1..1: the identity up to
 * `threshold`, then a smooth bend (tanh, same slope at the joint) that approaches `ceiling` and
 * never reaches it. Odd in the input.
 */
export function limiterCurve(
  size: number,
  threshold: number,
  ceiling: number,
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(size * Float32Array.BYTES_PER_ELEMENT));
  const room = ceiling - threshold;
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= threshold ? a : threshold + room * Math.tanh((a - threshold) / room);
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

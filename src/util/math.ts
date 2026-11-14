/** One full turn in radians. */
export const TWO_PI = Math.PI * 2;

/** Number of distinct uint32 values: the domain of run seeds. */
export const UINT32_RANGE = 0x1_0000_0000;

/** Random run seed in the uint32 domain. Not for use inside src/core. */
export function randomSeed(source: () => number = Math.random): number {
  return Math.floor(source() * UINT32_RANGE);
}

/** Golden ratio conjugate: stepping by it spreads values evenly over 0..1. */
export const GOLDEN = 0.618034;

/** Multiply degrees by this to get radians. */
export const DEG_TO_RAD = Math.PI / 180;

/** Milliseconds in one second. */
export const MS_PER_SECOND = 1000;

/** Length of a 60 Hz frame: smoothing factors and spring constants are given per such frame. */
export const REFERENCE_FRAME_MS = MS_PER_SECOND / 60;

/** Sine wave in -1..1 with the given period; `phase` shifts it in radians. */
export function sineWave(timeMs: number, periodMs: number, phase = 0): number {
  return Math.sin((TWO_PI * timeMs) / periodMs + phase);
}

/** Sine wave in 0..1 (starts at 0.5 and rises); `phase` shifts it in radians. */
export function oscillate01(timeMs: number, periodMs: number, phase = 0): number {
  return 0.5 + 0.5 * sineWave(timeMs, periodMs, phase);
}

/**
 * Frame-rate independent smoothing: the share of the remaining distance to cover
 * in `deltaMs` when `lerp` is the share per 60 Hz frame.
 */
export function frameLerp(lerp: number, deltaMs: number): number {
  return 1 - Math.pow(1 - lerp, deltaMs / REFERENCE_FRAME_MS);
}

/** A value from the inclusive range `[min, max]`. */
export function pickRange(
  range: readonly [number, number],
  random: () => number = Math.random,
): number {
  return range[0] + (range[1] - range[0]) * random();
}

/** A whole number from the inclusive range `[min, max]`. */
export function pickInt(
  range: readonly [number, number],
  random: () => number = Math.random,
): number {
  return Math.min(range[1], range[0] + Math.floor((range[1] - range[0] + 1) * random()));
}

/** `t` limited to 0..1. */
export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Smooth start and end: 0 to 1 over `t` in 0..1, flat at both ends. */
export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

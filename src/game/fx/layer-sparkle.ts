import { pickRange } from '../../util/math';

/** A random time (ms) until the next twinkle, within the range. */
export function sparkleDelay(
  everyMs: readonly [number, number],
  random: () => number = Math.random,
): number {
  return pickRange(everyMs, random);
}

/**
 * A point on the rectangle `margin` pixels outside a layer `width` x `height` (centre at 0, 0):
 * `u` in 0..1 walks once around it, starting at the top left corner and going clockwise.
 */
export function ringPoint(
  u: number,
  width: number,
  height: number,
  margin: number,
): { x: number; y: number } {
  const w = width + margin * 2;
  const h = height + margin * 2;
  let d = (((u % 1) + 1) % 1) * 2 * (w + h);
  const left = -w / 2;
  const top = -h / 2;
  if (d < w) return { x: left + d, y: top };
  d -= w;
  if (d < h) return { x: -left, y: top + d };
  d -= h;
  if (d < w) return { x: -left - d, y: -top };
  d -= w;
  return { x: left, y: -top - d };
}

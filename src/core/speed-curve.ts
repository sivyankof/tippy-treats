import { BALANCE } from '../data/balance';

/**
 * Nominal flying speed above a tower of `height` layers, px/s (docs/02-gameplay.md, section 2):
 * one arc `base + (max - base) * (2t - t^2)`, `t = h / arcTo`, which flattens out at `arcTo`; from
 * there `max`. One curve for the whole tower: zones have no speed multipliers.
 */
export function speedCurve(height: number): number {
  const { base, arcTo, max } = BALANCE.speed;
  if (height >= arcTo) return max;
  const t = Math.max(0, height) / arcTo;
  return base + (max - base) * (2 * t - t * t);
}

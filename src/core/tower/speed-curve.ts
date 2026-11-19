import { BALANCE } from '../../data/tower/balance';

/**
 * Nominal flying speed above a tower of `height` layers, px/s (docs/02-gameplay.md, section 2):
 * one arc `start + (top - start) * (1 - (1 - t) ^ power)`, `t = h / arcTo`, which flattens out at
 * `arcTo`; from there `top`. One curve for the whole tower: zones have no speed multipliers.
 */
export function speedCurve(height: number): number {
  const { start, top, arcTo, power } = BALANCE.speed;
  if (height >= arcTo) return top;
  const t = Math.max(0, height) / arcTo;
  return start + (top - start) * (1 - (1 - t) ** power);
}

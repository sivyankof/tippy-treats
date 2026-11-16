import { BALANCE } from '../data/balance';

/**
 * Nominal flying speed above a tower of `height` layers, px/s (docs/02-gameplay.md, section 2):
 * `base + perLayer * h` up to `arcFrom`; from there to `arcTo` the growth eases off along
 * `arcStart + (max - arcStart) * (2t - t^2)`, `t = (h - arcFrom) / (arcTo - arcFrom)`; then `max`.
 * One curve for the whole tower: zones have no speed multipliers.
 */
export function speedCurve(height: number): number {
  const { base, perLayer, arcFrom, arcTo, arcStart, max } = BALANCE.speed;
  if (height <= arcFrom) return base + perLayer * height;
  if (height >= arcTo) return max;
  const t = (height - arcFrom) / (arcTo - arcFrom);
  return arcStart + (max - arcStart) * (2 * t - t * t);
}

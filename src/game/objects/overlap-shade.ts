import type { LayerBox } from './layer-draw';

/** A horizontal piece of the shade band, in the layer's own coordinates (centre at 0). */
export interface ShadeSpan {
  x0: number;
  x1: number;
}

/** The band split into a flat middle and the pieces that fall in the rounded top corners. */
export interface ShadeSegments {
  middle: ShadeSpan | null;
  left: ShadeSpan | null;
  right: ShadeSpan | null;
}

function clip(x0: number, x1: number, lo: number, hi: number): ShadeSpan | null {
  const a = Math.max(x0, lo);
  const b = Math.min(x1, hi);
  return b - a > 1e-6 ? { x0: a, x1: b } : null;
}

/**
 * Where the shade lies on a layer: the horizontal overlap with the layer above, kept inside the
 * inner silhouette and cut into the middle and the two corner pieces (the corners are drawn
 * with a rounded picture, so no shade pokes out of the rounded outline).
 * `lowerX`/`lowerW` and `upperX`/`upperW` are the centres and widths of the two layers.
 */
export function shadeSegments(
  box: LayerBox,
  lowerX: number,
  upperX: number,
  upperW: number,
): ShadeSegments {
  const x0 = upperX - upperW / 2 - lowerX;
  const x1 = upperX + upperW / 2 - lowerX;
  const r = box.innerRadius;
  const whole = clip(x0, x1, box.innerLeft, box.innerRight);
  if (!whole) return { middle: null, left: null, right: null };
  return {
    left: clip(whole.x0, whole.x1, box.innerLeft, box.innerLeft + r),
    middle: clip(whole.x0, whole.x1, box.innerLeft + r, box.innerRight - r),
    right: clip(whole.x0, whole.x1, box.innerRight - r, box.innerRight),
  };
}

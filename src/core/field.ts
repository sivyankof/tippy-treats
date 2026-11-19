import { LOGICAL_SIZE } from '../data/app/screen';

/** Horizontal bounds of the play field: a placed layer never sticks out of them. */
export const FIELD_BOUNDS = { left: 0, right: LOGICAL_SIZE.width } as const;

/** A layer's centre and width. */
export interface LayerSpan {
  x: number;
  width: number;
}

/**
 * Grows a layer by `amount` without leaving the field. The width never exceeds the maximum
 * layer width or the field width. The growth is symmetric around the centre; when one side
 * lacks room the layer shifts and the rest of the growth goes to the free side. A layer that
 * is already past a field edge is moved back inside (`amount` 0 does just that). `cap` is the
 * widest the layer may grow (`TowerState.widthCap`: the lap narrowing of Space lowers it); it is
 * required so that no widening path can skip the lap limit. A wider layer is not cut.
 */
export function growInField(x: number, width: number, amount: number, cap: number): LayerSpan {
  const fieldWidth = FIELD_BOUNDS.right - FIELD_BOUNDS.left;
  const limit = Math.min(cap, fieldWidth);
  const grown = Math.max(width, Math.min(limit, width + Math.max(0, amount)));
  const half = grown / 2;
  const centre = Math.min(FIELD_BOUNDS.right - half, Math.max(FIELD_BOUNDS.left + half, x));
  return { x: centre, width: grown };
}

import { TOWER_SPARKLES } from '../../data/tower/tower-sparkles';

/** Where the tower is, as the sparkles need it (world space). */
export interface SparkleField {
  /** Horizontal extent of the widest layer a sparkle can reach (the top rows of the tower). */
  left: number;
  right: number;
  /** Top of the top layer and the height of one layer. */
  topY: number;
  layerHeight: number;
  /** Width of the screen. */
  screenWidth: number;
  /** The column the flying layer and its shadow use; `null` when none flies. */
  avoid: Readonly<{ left: number; right: number }> | null;
}

/** Three draws of 0..1: which side, how far out, how high. */
export type SparkleDraw = readonly [side: number, out: number, row: number];

/**
 * A spot for a sparkle beside the top of the tower, or `null` when the draw falls on the
 * flying layer column, its shadow, or the edge of the screen. The sparkle never stands
 * over the tower itself: it is always outside the widest of the layers in its reach.
 */
export function sparkleSpot(
  field: SparkleField,
  [side, out, row]: SparkleDraw,
): { x: number; y: number } | null {
  const { gapPx, rowsAbove, rowsBelow, avoidPadPx, edgePx } = TOWER_SPARKLES;
  const gap = gapPx[0] + (gapPx[1] - gapPx[0]) * out;
  const x = side < 0.5 ? field.left - gap : field.right + gap;
  const rows = -rowsAbove + (rowsAbove + rowsBelow) * row;
  const y = field.topY + rows * field.layerHeight;
  if (x < edgePx || x > field.screenWidth - edgePx) return null;
  const { avoid } = field;
  // The column of the flying layer reaches from above the tower down to the top layer.
  const inFlyZone = y < field.topY + field.layerHeight * rowsAbove;
  if (avoid && inFlyZone && x > avoid.left - avoidPadPx && x < avoid.right + avoidPadPx)
    return null;
  return { x, y };
}

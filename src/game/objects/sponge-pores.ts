import type { CutSide } from '../../core/drop';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { cutStripWidth } from './glaze-wave';
import type { LayerBox } from './layer-draw';

/** Steps of the R2 sequence: points spread evenly over a square without a random generator. */
const R2_X = 0.7548776662;
const R2_Y = 0.5698402911;

/**
 * How far the inner area of the layer starts inside its side at height `y`: 0 along the
 * straight sides, more in the rounded corners, `Infinity` above or below the inner area.
 */
export function innerInsetAt(box: LayerBox, y: number): number {
  if (y < box.innerTop || y > box.innerBottom) return Infinity;
  const r = box.innerRadius;
  const fromEdge = Math.min(y - box.innerTop, box.innerBottom - y);
  if (fromEdge >= r) return 0;
  const dy = r - fromEdge;
  return r - Math.sqrt(Math.max(0, r * r - dy * dy));
}

/** One pore: centre and radius. */
export interface Pore {
  x: number;
  y: number;
  r: number;
}

/**
 * Pores of the sponge of a plain layer, between `topY` (under the glaze) and the bottom. They
 * repeat in tiles counted from the intact edge, so the ones there stay put after a bite; none
 * sit in front of the face (`faceHalf` either side of the centre; `null`: a faceless piece), on
 * the bitten edge's sponge or within `inset` of the outline.
 */
export function spongePores(
  box: LayerBox,
  cut: CutSide | null,
  faceHalf: number | null,
  topY: number,
): Pore[] {
  const { areaPerPore, radii, inset, tileWidth } = PLAIN_LAYER.pores;
  const strip = cut ? cutStripWidth(box) : 0;
  const left = box.innerLeft + (cut === 'left' ? strip : 0);
  const right = box.innerRight - (cut === 'right' ? strip : 0);
  const height = box.innerBottom - inset - topY;
  if (height <= 0 || right <= left) return [];
  const perTile = Math.max(1, Math.round((tileWidth * height) / areaPerPore));
  // Counted from the intact edge: the left one, or the right one when the left is bitten.
  const fromRight = cut === 'left';
  const anchor = fromRight ? right : left;
  const dir = fromRight ? -1 : 1;
  const tiles = Math.ceil((right - left) / tileWidth);
  const pores: Pore[] = [];
  for (let t = 0; t < tiles; t++) {
    for (let j = 0; j < perTile; j++) {
      const u = (0.5 + (j + 1) * R2_X) % 1;
      const v = (0.5 + (j + 1) * R2_Y) % 1;
      const r = radii[j % radii.length]!;
      const x = anchor + dir * (t + u) * tileWidth;
      const y = topY + r + v * Math.max(0, height - r * 2);
      if (faceHalf !== null && Math.abs(x) < faceHalf + r) continue;
      const side = innerInsetAt(box, y + r) + inset + r;
      if (x < left + side || x > right - side) continue;
      pores.push({ x, y, r });
    }
  }
  return pores;
}

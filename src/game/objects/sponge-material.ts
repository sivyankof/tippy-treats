import type { CutSide } from '../../core/tower/drop';
import { PLAIN_LAYER } from '../../data/tower/plain-layers';
import { TWO_PI } from '../../util/math';
import type { LayerBox } from './layer-draw';
import { clipPolylines, uAxis, xAt, type Polyline, type Stroke } from './plain-lines';
import { innerInsetAt } from './sponge-pores';

const M = PLAIN_LAYER.marble;
const W = PLAIN_LAYER.waffle;
const STEP = PLAIN_LAYER.pattern.step;

/** Where a sponge material may be drawn: below `topY`, off the outline, the cut and the face. */
function spongeInside(
  box: LayerBox,
  topY: number,
  inset: number,
  faceEdge: number,
  half: number,
  cut: CutSide | null,
): (x: number, y: number) => boolean {
  const axis = uAxis(box, cut);
  const lo = Math.min(axis.anchor, xAt(axis, axis.length));
  const hi = Math.max(axis.anchor, xAt(axis, axis.length));
  const bottom = box.innerBottom - inset - half;
  return (x, y) => {
    if (y < topY + half || y > bottom || Math.abs(x) < faceEdge) return false;
    const side = innerInsetAt(box, y + half) + inset;
    return x >= lo + side && x <= hi - side;
  };
}

/**
 * The shortest piece of a ribbon that is drawn on a side stretch `sideSpan` wide (the space left
 * beside the face): `minLength` on a wide layer, shorter on a narrow one so some ribbons stay.
 */
export function marbleMinLength(sideSpan: number): number {
  return Math.max(M.minFloor, Math.min(M.minLength, M.minShare * sideSpan));
}

/**
 * Strokes of the marble sponge from `topY` down: long smooth wavy ribbons (caramel, light and a
 * thin white one; an edge under each but the white). They are counted from the uncut edge and break in front of the face
 * (`faceHalf` either side of the centre; `null`: a faceless piece).
 */
export function marbleStrokes(
  box: LayerBox,
  cut: CutSide | null,
  faceHalf: number | null,
  topY: number,
): Stroke[] {
  const axis = uAxis(box, cut);
  const faceEdge = faceHalf === null ? 0 : faceHalf + M.faceMargin;
  const height = box.innerBottom - topY;
  const minLength = marbleMinLength(axis.length / 2 - faceEdge - M.inset);
  const strokes: Stroke[] = [];
  for (const rib of M.ribbons) {
    const y0 = topY + height * rib.yShare;
    // The edge stroke is wider than the ribbon, so the margin takes it in.
    const reach = rib.width / 2 + (rib.edge !== null ? M.edgePx : 0);
    const inside = spongeInside(box, topY, M.inset, faceEdge, reach, cut);
    const lines = clipPolylines(
      (u) => [xAt(axis, u), y0 + rib.amplitude * Math.sin((TWO_PI * u) / rib.period + rib.phase)],
      0,
      axis.length,
      STEP,
      inside,
    ).filter((line) => (line.length / 2) * STEP >= minLength);
    if (rib.edge !== null) {
      strokes.push({ color: rib.edge, width: rib.width + M.edgePx * 2, lines });
    }
    strokes.push({ color: rib.color, width: rib.width, lines });
  }
  return strokes;
}

/**
 * Strokes of the waffle sponge from `topY` down: a square grid counted from the uncut edge (and
 * from the top of the sponge) and a thin cream layer across, broken in front of the face.
 */
export function waffleStrokes(
  box: LayerBox,
  cut: CutSide | null,
  faceHalf: number | null,
  topY: number,
): Stroke[] {
  const axis = uAxis(box, cut);
  const faceEdge = faceHalf === null ? 0 : faceHalf + W.faceMargin;
  const height = box.innerBottom - topY;
  const inside = spongeInside(box, topY, W.inset, faceEdge, 0, cut);
  const lines: Polyline[] = [];
  for (let k = 1; k * W.cell < axis.length; k++) {
    const x = xAt(axis, k * W.cell);
    lines.push(...clipPolylines((y) => [x, y], topY, box.innerBottom, STEP, inside));
  }
  for (let j = 1; topY + j * W.cell < box.innerBottom; j++) {
    const y = topY + j * W.cell;
    lines.push(...clipPolylines((u) => [xAt(axis, u), y], 0, axis.length, STEP, inside));
  }
  const creamY = topY + height * W.creamYShare;
  const creamInside = spongeInside(box, topY, W.inset, faceEdge, W.creamWidth / 2, cut);
  const cream = clipPolylines((u) => [xAt(axis, u), creamY], 0, axis.length, STEP, creamInside);
  return [
    { color: W.line, width: W.lineWidth, lines },
    { color: W.creamEdge, width: W.creamWidth + W.creamEdgePx * 2, lines: cream },
    { color: W.cream, width: W.creamWidth, lines: cream },
  ];
}

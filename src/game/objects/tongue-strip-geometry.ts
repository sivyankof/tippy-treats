import { LICK } from '../../data/lick';
import type { Ribbon } from './tongue-ribbon';

/**
 * The tongue as triangle strips (docs/06, "Слизывание глазури"): a row is a pair of vertices, the
 * left (`across` -1) and the right (+1) edge at one sample of the ribbon, four floats `x0, y0, x1,
 * y1`. The body has a row per sample, behind them a rounded root and in front of them the round
 * tip, each of `TIP_ROWS` rows along a half ellipse. Pure maths, no Phaser.
 */
export const TRUNK_ROWS = LICK.tongue.segments * LICK.tongue.strip.sub + 1;
/** The rim of the tip is `tipSteps` steps round a half ellipse, so a quarter of them is one side. */
export const TIP_ROWS = LICK.tongue.draw.tipSteps / 2;
/** The root is rounded like the tip is, with as many rows. */
export const CAP_ROWS = TIP_ROWS;
const QUARTER = Math.PI / 2;
const FLOATS_PER_ROW = 4;

/** The floats of a strip of `rows` rows. */
export function stripFloats(rows: number): number {
  return rows * FLOATS_PER_ROW;
}

/** Row `row` of `out`: sample `j` of the ribbon, the width grown by `grow` on both sides. */
export function writeRow(r: Ribbon, j: number, grow: number, out: Float32Array, row: number): void {
  const half = r.half[j]! + grow;
  const nx = -r.ty[j]!;
  const ny = r.tx[j]!;
  const at = row * FLOATS_PER_ROW;
  out[at] = r.x[j]! - nx * half;
  out[at + 1] = r.y[j]! - ny * half;
  out[at + 2] = r.x[j]! + nx * half;
  out[at + 3] = r.y[j]! + ny * half;
}

/** The body rows of the ribbon from row `from` of `out`. */
export function writeTrunkRows(r: Ribbon, grow: number, out: Float32Array, from = 0): void {
  for (let j = 0; j < r.count; j++) writeRow(r, j, grow, out, from + j);
}

/** The row of a half ellipse at angle `a` round `(cx, cy)`: `along` ahead on (`tx`, `ty`), `across` to each side. */
function writeEllipseRow(
  out: Float32Array,
  row: number,
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  along: number,
  across: number,
): void {
  const x = cx + tx * along;
  const y = cy + ty * along;
  const at = row * FLOATS_PER_ROW;
  out[at] = x + ty * across;
  out[at + 1] = y - tx * across;
  out[at + 2] = x - ty * across;
  out[at + 3] = y + tx * across;
}

/**
 * The `TIP_ROWS` rows of the rounded tip from row `from` of `out`, going on from the last sample:
 * a half ellipse as tall as `LICK.tongue.tipShare` of the width, grown by `grow` on every side. The
 * last row is the point of the ellipse (no width).
 */
export function writeTipRows(r: Ribbon, grow: number, out: Float32Array, from: number): void {
  const k = r.count - 1;
  const half = r.half[k]! + grow;
  const height = r.half[k]! * 2 * LICK.tongue.tipShare + grow;
  for (let i = 1; i <= TIP_ROWS; i++) {
    const a = (i / TIP_ROWS) * QUARTER;
    writeEllipseRow(
      out,
      from + i - 1,
      r.x[k]!,
      r.y[k]!,
      r.tx[k]!,
      r.ty[k]!,
      Math.sin(a) * height,
      Math.cos(a) * half,
    );
  }
}

/** The sample the circle of the round root sits on: half a piece from the mouth, as the pieces drawn by hand had it. */
function capSample(r: Ribbon): number {
  return Math.max(1, Math.floor(r.sub / 2));
}

/**
 * The `CAP_ROWS` rows of the round root from row `from` of `out`, from its point to the first
 * sample: the back half of the circle that sits half a piece along (the width there, grown by
 * `grow`), so the tongue leaves the mouth rounded, not cut. They end where the first sample is.
 */
export function writeCapRows(r: Ribbon, grow: number, out: Float32Array, from: number): void {
  const c = capSample(r);
  const radius = r.half[c]! + grow;
  const gap = Math.hypot(r.x[c]! - r.x[0]!, r.y[c]! - r.y[0]!);
  const first = radius > 0 ? Math.asin(Math.min(1, gap / radius)) : 0;
  for (let i = 0; i < CAP_ROWS; i++) {
    const a = QUARTER - (QUARTER - first) * (i / (CAP_ROWS - 1));
    writeEllipseRow(
      out,
      from + i,
      r.x[c]!,
      r.y[c]!,
      r.tx[c]!,
      r.ty[c]!,
      -Math.sin(a) * radius,
      Math.cos(a) * radius,
    );
  }
}

/** Where the pictures of the strip sit in its baked texture (texture px). */
export interface StripLayout {
  /** Texture size. */
  width: number;
  height: number;
  /** Rows of plain fill at the top (the root), then rows of body with the stripe and the groove. */
  plain: number;
  band: number;
  /** The tip picture's height as it is mapped: the tip is `tipShare` of the body width tall. */
  tipHeight: number;
}

export function stripLayout(): StripLayout {
  const { texPx, plainPx, bandPx } = LICK.tongue.strip;
  const tipHeight = texPx * LICK.tongue.tipShare;
  return {
    width: texPx,
    height: plainPx + bandPx + Math.ceil(tipHeight),
    plain: plainPx,
    band: bandPx,
    tipHeight,
  };
}

/** Rows of the strip of the body: the round root, the first sample twice (root picture, then body picture) and the samples. */
export const BODY_STRIP_ROWS = CAP_ROWS + 1 + TRUNK_ROWS;
/** Rows of the outline strip: root, samples, tip. */
export const OUTLINE_STRIP_ROWS = CAP_ROWS + TRUNK_ROWS + TIP_ROWS;
/** Rows of the tip strip: the last sample and the tip. */
export const TIP_STRIP_ROWS = TIP_ROWS + 1;

/** The uv (shares of the picture) of the body strip: plain fill for the root, then the plain band across the picture. */
export function bodyUvs(): Float32Array {
  const layout = stripLayout();
  const plainV = layout.plain / 2 / layout.height;
  const bandV = (layout.plain + layout.band / 2) / layout.height;
  const uv = new Float32Array(stripFloats(BODY_STRIP_ROWS));
  for (let i = 0; i < BODY_STRIP_ROWS; i++) {
    const v = i <= CAP_ROWS ? plainV : bandV;
    uv.set([0, v, 1, v], i * FLOATS_PER_ROW);
  }
  return uv;
}

/** The uv of the tip strip: the junction row on the last sample, then the `TIP_ROWS` rows of `writeTipRows`. */
export function tipUvs(): Float32Array {
  const layout = stripLayout();
  const uv = new Float32Array(stripFloats(TIP_STRIP_ROWS));
  const top = (layout.plain + layout.band) / layout.height;
  uv.set([0, top, 1, top], 0);
  for (let i = 1; i <= TIP_ROWS; i++) {
    const a = (i / TIP_ROWS) * QUARTER;
    const v = (layout.plain + layout.band + Math.sin(a) * layout.tipHeight) / layout.height;
    const c = Math.cos(a);
    uv.set([(1 - c) / 2, v, (1 + c) / 2, v], i * FLOATS_PER_ROW);
  }
  return uv;
}

/** The uv of the outline strip: one plain colour, every row in the middle of its picture. */
export function solidUvs(): Float32Array {
  const uv = new Float32Array(stripFloats(OUTLINE_STRIP_ROWS));
  uv.fill(0.5);
  return uv;
}

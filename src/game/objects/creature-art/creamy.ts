import { ANIM } from '../../../data/anim';
import { shade } from '../../../util/color';
import { drawGlaze, drawShadow } from '../layer-draw';
import {
  countFor,
  drawBase,
  drawFinish,
  fillBand,
  outlineOf,
  outlinedCircle,
  spread,
  stroke,
  type ArtContext,
  type Graphics,
  type Recipe,
} from './primitives';

const SIDE_MARGIN = 16;
const PUFF_MIN_SCALE = 0.8;
const PUFF_ICING_DEPTH = 0.3;
const GROOVE_WIDTH = 4;
const GROOVE_ALPHA = 0.7;
const FACE_CLEAR_HALF = 80;
const FACE_CLEAR_SHARE = 0.3;
const PEAK_SPREAD = 0.27;
const PEAK_OVERLAP = 10;
const PEAK_CURL_RADIUS = 8;
const SWIRL_WIDTH = 4;
const SWIRL_ALPHA = 0.45;
const MERINGUE_CAP_DEPTH = 0.22;
const CARAMEL_SHINE_ALPHA = 0.6;
const CARAMEL_SHINE_DEPTH = 8;
const RIB_WIDTH = 3;
const RIB_ALPHA = 0.6;
const CREAM_SCALLOP_RADIUS = 9;
const SLICE_RIND_SHADE = -0.12;
const SLICE_SEGMENTS = 8;
const SLICE_RING = 5;
const SLICE_FLESH_INSET = 9;
const SLICE_LINE = 2.5;

/** Marshmallow: round puffs on top, vertical grooves, pale pink icing. */
export function drawPuff(ctx: ArtContext, r: Recipe<'puff'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  const count = box.width >= r.wideFrom ? r.puffsWide : r.puffsNarrow;
  const maxRadius = Math.min(r.puffRadius, box.width / (count * 2.2));
  const y = box.top - r.topPad + maxRadius + outline;
  drawShadow(g, box);
  for (let i = 0; i < count; i++) {
    const middle = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2 || 1);
    const radius = maxRadius * (1 - (1 - PUFF_MIN_SCALE) * middle);
    const x = spread(i, count, box.left + box.radius, box.right - box.radius);
    outlinedCircle(g, x, y, radius, colors.glaze, outlineOf(colors.glaze), outline);
  }
  drawBase(ctx);

  const grooves = countFor(box.width, r.grooves);
  const clear = Math.min(FACE_CLEAR_HALF, box.width * FACE_CLEAR_SHARE);
  for (let i = 0; i < grooves; i++) {
    const x = spread(i, grooves, box.innerLeft + SIDE_MARGIN, box.innerRight - SIDE_MARGIN);
    if (Math.abs(x) < clear) continue;
    g.fillStyle(colors.accent, GROOVE_ALPHA);
    g.fillRoundedRect(
      x - GROOVE_WIDTH / 2,
      box.innerTop + 10,
      GROOVE_WIDTH,
      box.innerH - 20,
      GROOVE_WIDTH / 2,
    );
  }
  drawGlaze(g, box, colors.glaze, { depth: PUFF_ICING_DEPTH, dripCount: 0 });
  drawFinish(ctx);
}

/** One meringue peak: a cone with a curled tip, outline first. */
function drawPeak(
  g: Graphics,
  x: number,
  baseY: number,
  width: number,
  height: number,
  lean: number,
  fill: number,
): void {
  const { outline } = ANIM.layer;
  const tipX = x + lean * PEAK_CURL_RADIUS;
  const tipY = baseY - height;
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    g.fillStyle(pass === 'outline' ? outlineOf(fill) : fill, 1);
    g.fillTriangle(x - width / 2 - grow, baseY, x + width / 2 + grow, baseY, tipX, tipY - grow * 2);
    g.fillCircle(tipX, tipY + PEAK_CURL_RADIUS / 2, PEAK_CURL_RADIUS + grow);
  }
}

/** Meringue ghost: two curled peaks, twisted grooves, a faint lilac cap. */
export function drawGhost(ctx: ArtContext, r: Recipe<'ghost'>): void {
  const { g, box, colors } = ctx;
  const reach = box.width * PEAK_SPREAD;
  drawShadow(g, box);
  drawPeak(g, -reach, box.top + PEAK_OVERLAP, r.peakWidth, r.peakHeight, 1, colors.body);
  drawPeak(g, reach, box.top + PEAK_OVERLAP, r.peakWidth, r.peakHeight, -1, colors.body);
  drawBase(ctx);
  drawGlaze(g, box, colors.glaze, { depth: MERINGUE_CAP_DEPTH, dripCount: 0 });

  const swirls = Math.max(1, Math.floor(box.innerW / r.swirlStep));
  const bottom = box.innerBottom - 8;
  const top = box.innerTop + 10;
  for (let i = 0; i < swirls; i++) {
    const x = spread(i, swirls, box.innerLeft + SIDE_MARGIN, box.innerRight - SIDE_MARGIN);
    stroke(g, SWIRL_WIDTH, colors.accent, SWIRL_ALPHA, [
      [x - 9, bottom],
      [x + 4, (bottom + top) / 2 + 8],
      [x - 4, (bottom + top) / 2 - 8],
      [x + 9, top],
    ]);
  }
  drawFinish(ctx);
}

/** Crème caramel: pale custard body under a dark glossy caramel cap with drips. */
export function drawCaramel(ctx: ArtContext, r: Recipe<'caramel'>): void {
  const { g, box, colors } = ctx;
  drawBase(ctx);
  drawGlaze(g, box, colors.glaze, {
    depth: r.capDepth,
    dripCount: r.dripCount,
    dripLength: r.dripLength,
  });
  fillBand(
    g,
    box,
    box.innerTop + 3,
    box.innerTop + 3 + CARAMEL_SHINE_DEPTH,
    colors.detail,
    CARAMEL_SHINE_ALPHA,
  );
  drawFinish(ctx);
}

/** Lemon slice stuck in the cream: rind, pith ring, flesh and segment lines. */
function drawSlice(g: Graphics, x: number, y: number, radius: number, ctx: ArtContext): void {
  const { colors } = ctx;
  const { outline } = ANIM.layer;
  const rind = shade(colors.glaze, SLICE_RIND_SHADE);
  outlinedCircle(g, x, y, radius, rind, outlineOf(rind), outline);
  g.fillStyle(colors.accent, 1);
  g.fillCircle(x, y, radius - SLICE_RING / 2);
  g.fillStyle(colors.glaze, 1);
  g.fillCircle(x, y, radius - SLICE_FLESH_INSET);
  for (let i = 0; i < SLICE_SEGMENTS; i++) {
    const a = (i / SLICE_SEGMENTS) * Math.PI;
    const reach = radius - SLICE_FLESH_INSET;
    stroke(g, SLICE_LINE, colors.accent, 1, [
      [x - Math.cos(a) * reach, y - Math.sin(a) * reach],
      [x + Math.cos(a) * reach, y + Math.sin(a) * reach],
    ]);
  }
}

/** Lemon tart: sand shell with ribs, yellow cream with a wavy edge, a lemon slice on top. */
export function drawLemon(ctx: ArtContext, r: Recipe<'lemon'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  drawShadow(g, box);
  drawSlice(g, 0, box.top - r.topPad + r.sliceRadius + outline, r.sliceRadius, ctx);
  drawBase(ctx);

  const ribs = Math.floor(box.innerW / r.ribStep);
  for (let i = 0; i < ribs; i++) {
    const x = spread(i, ribs, box.innerLeft + SIDE_MARGIN / 2, box.innerRight - SIDE_MARGIN / 2);
    stroke(g, RIB_WIDTH, colors.detail, RIB_ALPHA, [
      [x, box.innerTop + box.height * r.creamShare - 6],
      [x, box.innerBottom - 4],
    ]);
  }
  drawGlaze(g, box, colors.glaze, {
    depth: r.creamShare,
    dripCount: 0,
    scallop: { radius: CREAM_SCALLOP_RADIUS, step: CREAM_SCALLOP_RADIUS * 2 },
  });
  drawFinish(ctx);
}

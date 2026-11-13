import { ANIM } from '../../../data/anim';
import { parseHex, shade } from '../../../util/color';
import { PALETTE } from '../../../data/palette';
import { drawGlaze, drawGloss, drawShadow } from '../layer-draw';
import {
  countFor,
  drawBase,
  drawFinish,
  fillBand,
  outlineOf,
  scallops,
  scatter,
  spread,
  type ArtContext,
  type Graphics,
  type Recipe,
} from './primitives';

const SIDE_MARGIN = 16;
const GLOW_INSET = 10;
const GLOW_ALPHA = 0.22;
const BUBBLE_ALPHA = 0.55;
const BUBBLE_MIN = 3;
const BUBBLE_RANGE = 5;
const BUBBLE_SHINE = 0.3;
const JELLY_STREAK_WIDTH = 8;
const JELLY_STREAK_ALPHA = 0.55;
const WAFER_SEAM = 3;
const WAFER_BOTTOM_SHADE = -0.12;
const HOLE_RADIUS = 2.5;
const CRYSTAL_WIDTH = 20;
const CRYSTAL_STEP = 18;
const CRYSTAL_HEIGHT_STEP = 8;
const CRYSTAL_INSET = 30;
const CRYSTAL_NARROW_SHARE = 0.3;
const CROWN_PEAK_WIDTH = 18;
const CROWN_SIDE_HEIGHT = 20;
const CROWN_SPREAD = 46;
const CROWN_SPREAD_SHARE = 0.2;
const CROWN_OVERLAP = 12;
const CROWN_JEWEL = 4;
const CREAM_DRIP_LENGTH = 14;
const CREAM_DRIPS = 3;

/** Jelly: see-through teal body with bubbles, a wavy top edge and a strong shine. */
export function drawJelly(ctx: ArtContext, r: Recipe<'jelly'>): void {
  const { g, box, colors } = ctx;
  const { outline, gradientLift } = ANIM.layer;
  drawShadow(g, box);
  const y = box.top - r.topPad + r.scallopRadius + outline;
  scallops(
    g,
    box.left + box.radius,
    box.right - box.radius,
    y,
    r.scallopRadius,
    r.scallopStep,
    shade(colors.body, gradientLift),
    outline,
  );
  drawBase(ctx);

  g.fillStyle(colors.detail, GLOW_ALPHA);
  g.fillRoundedRect(
    box.innerLeft + GLOW_INSET,
    box.innerTop + GLOW_INSET,
    box.innerW - GLOW_INSET * 2,
    box.innerH - GLOW_INSET * 2,
    box.innerRadius,
  );
  const bubbles = countFor(box.width, r.bubbles);
  for (let i = 0; i < bubbles; i++) {
    const radius = BUBBLE_MIN + BUBBLE_RANGE * scatter(i, 0.3);
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.15) * (box.innerW - SIDE_MARGIN * 2);
    const y2 = box.innerTop + SIDE_MARGIN + scatter(i, 0.55) * (box.innerH - SIDE_MARGIN * 2);
    g.fillStyle(colors.accent, BUBBLE_ALPHA);
    g.fillCircle(x, y2, radius);
    g.fillStyle(PALETTE.textLight, 1);
    g.fillCircle(x - radius * BUBBLE_SHINE, y2 - radius * BUBBLE_SHINE, radius * BUBBLE_SHINE);
  }
  g.fillStyle(PALETTE.textLight, JELLY_STREAK_ALPHA);
  g.fillRoundedRect(
    box.innerRight - SIDE_MARGIN - JELLY_STREAK_WIDTH * 2,
    box.innerTop + SIDE_MARGIN,
    JELLY_STREAK_WIDTH,
    box.innerH * 0.5,
    JELLY_STREAK_WIDTH / 2,
  );
  drawFinish(ctx);
  // A second pass of the gloss: jelly shines more than the rest.
  drawGloss(g, box);
}

/** Pointed ice crystal standing on the top edge, outline first. */
function drawCrystal(
  g: Graphics,
  x: number,
  baseY: number,
  height: number,
  lean: number,
  fill: number,
): void {
  const { outline } = ANIM.layer;
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    g.fillStyle(pass === 'outline' ? outlineOf(fill) : fill, 1);
    g.fillTriangle(
      x - CRYSTAL_WIDTH / 2 - grow,
      baseY,
      x + CRYSTAL_WIDTH / 2 + grow,
      baseY,
      x + lean * CRYSTAL_WIDTH * 0.4,
      baseY - height - grow * 2,
    );
  }
}

/** Ice cream sandwich: dark dotted wafers over a white strip, ice crystals on the corners. */
export function drawFrosty(ctx: ArtContext, r: Recipe<'frosty'>): void {
  const { g, box, colors } = ctx;
  drawShadow(g, box);
  const edge = Math.min(CRYSTAL_INSET, box.width * CRYSTAL_NARROW_SHARE);
  for (let k = 0; k < r.crystals; k++) {
    const height = r.topPad - 6 - k * CRYSTAL_HEIGHT_STEP;
    const base = box.top + 8;
    drawCrystal(g, box.left + edge + k * CRYSTAL_STEP, base, height, -1, colors.accent);
    drawCrystal(g, box.right - edge - k * CRYSTAL_STEP, base, height, 1, colors.accent);
  }
  drawBase(ctx);

  const wafer = box.innerH * r.waferShare;
  const topFill = colors.glaze;
  const bottomFill = shade(colors.glaze, WAFER_BOTTOM_SHADE);
  const seam = outlineOf(colors.glaze);
  const rad = box.innerRadius;
  g.fillStyle(topFill, 1);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, wafer, {
    tl: rad,
    tr: rad,
    bl: 0,
    br: 0,
  });
  g.fillStyle(bottomFill, 1);
  g.fillRoundedRect(box.innerLeft, box.innerBottom - wafer, box.innerW, wafer, {
    tl: 0,
    tr: 0,
    bl: rad,
    br: rad,
  });
  g.fillStyle(seam, 1);
  g.fillRect(box.innerLeft, box.innerTop + wafer - WAFER_SEAM / 2, box.innerW, WAFER_SEAM);
  g.fillRect(box.innerLeft, box.innerBottom - wafer - WAFER_SEAM / 2, box.innerW, WAFER_SEAM);

  const holes = Math.floor((box.innerW - rad * 2) / r.holeStep);
  g.fillStyle(colors.detail, 1);
  for (let i = 0; i < holes; i++) {
    const x = spread(i, holes, box.innerLeft + rad, box.innerRight - rad);
    g.fillCircle(x, box.innerTop + wafer / 2, HOLE_RADIUS);
    g.fillCircle(x, box.innerBottom - wafer / 2, HOLE_RADIUS);
  }
  drawFinish(ctx);
}

/** Macaron: lilac top shell, cream strip, darker bottom shell, ruffled "skirts" on both shells. */
export function drawTwins(ctx: ArtContext, r: Recipe<'twins'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  drawBase(ctx);
  const seamTop = box.innerTop + box.innerH * r.topShare;
  const seamBottom = seamTop + box.innerH * r.creamShare;
  fillBand(g, box, seamTop, seamBottom, colors.accent);
  fillBand(g, box, seamBottom, box.innerBottom, colors.glaze);
  const x0 = box.innerLeft + box.innerRadius;
  const x1 = box.innerRight - box.innerRadius;
  const step = r.skirtRadius * 2;
  scallops(g, x0, x1, seamTop, r.skirtRadius, step, colors.detail, outline);
  scallops(g, x0, x1, seamBottom, r.skirtRadius, step, shade(colors.glaze, 0.1), outline);
  drawFinish(ctx);
}

/** Rainbow cake: six thin bands under white cream, a small cream crown on top. */
export function drawRainbow(ctx: ArtContext, r: Recipe<'rainbow'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  drawShadow(g, box);

  const middle = box.top - r.topPad + outline / 2 + CROWN_PEAK_WIDTH / 2;
  const spreadX = Math.min(CROWN_SPREAD, box.width * CROWN_SPREAD_SHARE);
  const peaks = r.crown;
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    g.fillStyle(pass === 'outline' ? outlineOf(colors.glaze) : colors.glaze, 1);
    for (let i = 0; i < peaks; i++) {
      const offset = i - (peaks - 1) / 2;
      const height = offset === 0 ? r.topPad - outline / 2 : CROWN_SIDE_HEIGHT;
      const w = CROWN_PEAK_WIDTH + grow * 2;
      const x = offset * spreadX;
      g.fillRoundedRect(
        x - w / 2,
        box.top - height - grow,
        w,
        height + CROWN_OVERLAP + grow,
        w / 2,
      );
    }
  }
  g.fillStyle(colors.accent, 1);
  g.fillCircle(0, middle, CROWN_JEWEL);

  drawBase(ctx);
  const bands = r.bands.map(parseHex);
  const start = box.top + box.height * r.creamShare;
  for (let i = 0; i < bands.length; i++) {
    const y0 = start + ((box.innerBottom - start) * i) / bands.length;
    const y1 = start + ((box.innerBottom - start) * (i + 1)) / bands.length;
    fillBand(g, box, y0, y1, bands[i] ?? colors.body);
  }
  drawGlaze(g, box, colors.glaze, {
    depth: r.creamShare,
    dripCount: CREAM_DRIPS,
    dripLength: CREAM_DRIP_LENGTH,
  });
  drawFinish(ctx);
}

import { ANIM } from '../../../data/anim';
import { CREATURE_STYLE } from '../../../data/creature-style';
import { shade } from '../../../util/color';
import { PALETTE } from '../../../data/palette';
import { faceRecipe } from '../../../data/creature-looks';
import { faceHalfSpan } from '../../fx/glaze-growth';
import { faceLayout } from '../face-recipe';
import { drawShadow } from '../layer-draw';
import type { GlossSpot } from './flat-draw';
import { twinsSeam } from './twins-seam';
import {
  countFor,
  drawBase,
  drawFinish,
  fillBand,
  shadeBottom,
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

/** Jelly: see-through teal body with bubbles, a wavy top edge and a strong shine. */
export function drawJelly(ctx: ArtContext, r: Recipe<'jelly'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  drawShadow(g, box);
  const y = box.top - r.topPad + r.scallopRadius + outline;
  scallops(
    g,
    box.left + box.radius,
    box.right - box.radius,
    y,
    r.scallopRadius,
    r.scallopStep,
    colors.body,
    colors.outline,
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
  const bubbles = ctx.sleeping ? 0 : countFor(box.width, r.bubbles);
  for (let i = 0; i < bubbles; i++) {
    const radius = BUBBLE_MIN + BUBBLE_RANGE * scatter(i, 0.3);
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.15) * (box.innerW - SIDE_MARGIN * 2);
    const y2 = box.innerTop + SIDE_MARGIN + scatter(i, 0.55) * (box.innerH - SIDE_MARGIN * 2);
    g.fillStyle(colors.accent, BUBBLE_ALPHA);
    g.fillCircle(x, y2, radius);
    g.fillStyle(PALETTE.textLight, 1);
    g.fillCircle(x - radius * BUBBLE_SHINE, y2 - radius * BUBBLE_SHINE, radius * BUBBLE_SHINE);
  }
  g.fillStyle(PALETTE.textLight, ctx.sleeping ? 0 : JELLY_STREAK_ALPHA);
  g.fillRoundedRect(
    box.innerRight - SIDE_MARGIN - JELLY_STREAK_WIDTH * 2,
    box.innerTop + SIDE_MARGIN,
    JELLY_STREAK_WIDTH,
    box.innerH * 0.5,
    JELLY_STREAK_WIDTH / 2,
  );
  // Jelly shines more than the rest: a bigger gloss.
  drawFinish(ctx, CREATURE_STYLE.gloss.jellyScale);
}

/** Pointed ice crystal standing on the top edge, outline first. */
function drawCrystal(
  g: Graphics,
  x: number,
  baseY: number,
  height: number,
  lean: number,
  fill: number,
  outlineColor: number,
): void {
  const { outline } = ANIM.layer;
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    g.fillStyle(pass === 'outline' ? outlineColor : fill, 1);
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
    drawCrystal(
      g,
      box.left + edge + k * CRYSTAL_STEP,
      base,
      height,
      -1,
      colors.accent,
      colors.outline,
    );
    drawCrystal(
      g,
      box.right - edge - k * CRYSTAL_STEP,
      base,
      height,
      1,
      colors.accent,
      colors.outline,
    );
  }
  drawBase(ctx);

  const wafer = box.innerH * r.waferShare;
  const topFill = colors.glaze;
  const bottomFill = shade(colors.glaze, WAFER_BOTTOM_SHADE);
  const seam = colors.outline;
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
  shadeBottom(ctx);

  const holes = Math.floor((box.innerW - rad * 2) / r.holeStep);
  g.fillStyle(colors.detail, 1);
  for (let i = 0; i < holes; i++) {
    const x = spread(i, holes, box.innerLeft + rad, box.innerRight - rad);
    g.fillCircle(x, box.innerTop + wafer / 2, HOLE_RADIUS);
    g.fillCircle(x, box.innerBottom - wafer / 2, HOLE_RADIUS);
  }
  drawFinish(ctx);
}

/**
 * Where the Twins gloss goes: at the far left clear of the left face; where that leaves too
 * little room (a narrow layer) it moves down onto the upper shell below the face row.
 */
export function twinsGlossSpot(width: number): GlossSpot {
  const faceLeft = -faceHalfSpan(width, faceRecipe('twins')) - CREATURE_STYLE.gloss.faceGap;
  const room = faceLeft - (-width / 2 + CREATURE_STYLE.gloss.minInset);
  if (room >= CREATURE_STYLE.gloss.length) return { clearTo: faceLeft };
  // Below the eyes the left mouth is the obstacle (eyes-only faces have none): stop short of the
  // middle of the left face and start nearer the edge.
  const low = { y: CREATURE_STYLE.gloss.twinsLowY, inset: CREATURE_STYLE.gloss.minInset };
  const layout = faceLayout(width, faceRecipe('twins'));
  const pair = faceRecipe('twins').pair;
  // A shrunk face is too small a target to be worth the room it would cost.
  if (!layout.showRest || !pair || layout.scale < CREATURE_STYLE.gloss.twinsClearScale) return low;
  return { ...low, clearTo: -layout.scale * pair.spread - CREATURE_STYLE.gloss.faceGap };
}

/**
 * Macaron: a lilac top shell, a darker bottom shell and a cream strip in the middle. Along the
 * strip both shells have "feet": a thin rough band of small bumps.
 */
export function drawTwins(ctx: ArtContext, r: Recipe<'twins'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  drawBase(ctx);
  const seam = twinsSeam(box, r);
  fillBand(g, box, seam.bottom, box.innerBottom, colors.glaze);
  shadeBottom(ctx);
  // The feet sit on the seam; the cream drawn next hides their halves on its side.
  const x0 = box.innerLeft + box.innerRadius;
  const x1 = box.innerRight - box.innerRadius;
  const step = r.feetRadius * r.feetStep;
  scallops(
    g,
    x0,
    x1,
    seam.top,
    r.feetRadius,
    step,
    shade(colors.body, r.feetShade),
    colors.outline,
    outline,
  );
  scallops(
    g,
    x0,
    x1,
    seam.bottom,
    r.feetRadius,
    step,
    shade(colors.glaze, r.feetShade),
    colors.outline,
    outline,
  );
  fillBand(g, box, seam.top, seam.bottom, colors.accent);
  drawFinish(ctx, 1, twinsGlossSpot(box.width));
}

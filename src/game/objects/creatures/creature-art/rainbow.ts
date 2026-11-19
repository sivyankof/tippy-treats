import { faceRecipe } from '../../../../data/creatures/creature-looks';
import { CREATURE_STYLE } from '../../../../data/creatures/creature-style';
import { RAINBOW_LOOK } from '../../../../data/creatures/rainbow-look';
import { PALETTE } from '../../../../data/common/palette';
import { mixColor, parseHex } from '../../../../util/color';
import {
  drawGlossMark,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
} from '../../../fx/common/plain-style';
import { faceHalfSpan } from '../../../fx/glaze/glaze-growth';
import { drawShadow, type GlazeOptions } from '../../tower/layer-draw';
import { drawBody, drawGlaze } from './flat-draw';
import {
  bandEdge,
  bandPolygon,
  sampleXs,
  spongeRows,
  starPoints,
  waveLine,
} from './rainbow-geometry';
import {
  countFor,
  drawFinish,
  shadeBottom,
  spread,
  stroke,
  type ArtContext,
  type Recipe,
} from './primitives';

const { wave, band, star } = RAINBOW_LOOK;

/** The glaze options of the rainbow layer (the growing drips continue its drips); the idle wave reads the same ones. */
export function rainbowGlaze(): Pick<GlazeOptions, 'dripCount' | 'dripLength' | 'scallop'> {
  const { dripCount, dripLength, scallopRadius, scallopStep } = RAINBOW_LOOK.glaze;
  return { dripCount, dripLength, scallop: { radius: scallopRadius, step: scallopStep } };
}

/**
 * The gold star of the crown with its centre at (0, `cy`): outlined, with a gloss stroke and a dot
 * (the awake layer star bakes it once; `RainbowIdle` sways and flashes the picture).
 */
export function paintStar(
  g: ArtContext['g'],
  cy: number,
  fill: number = star.color,
  line: number = outlineColor(star.color),
  gloss = true,
): void {
  const r = star.radius;
  fillOutlinedPolygon(g, starPoints(0, cy, r, star.notch), fill, line, star.outline);
  if (!gloss) return;
  const mark = star.gloss;
  drawGlossMark(g, {
    x: mark.x * r,
    y: cy + mark.y * r,
    length: mark.length * r,
    thick: mark.thick * r,
    tilt: mark.tilt,
    dotGap: mark.dotGap,
    dotRadius: mark.dotRadius,
    color: PALETTE.textLight,
    alpha: 1,
  });
}

/** The sleeping silhouette star: still and muted. The awake layer star is drawn by `RainbowIdle`. */
function drawStar(ctx: ArtContext): void {
  paintStar(ctx.g, ctx.box.top - star.lift, ctx.colors.accent, ctx.colors.outline, false);
}

/** Five thin coloured sponges, each in two tones, with a white cream strip under each. */
function drawSponges(ctx: ArtContext, bands: readonly number[], top: number): void {
  const { g, box, colors } = ctx;
  const xs = sampleXs(box, wave.step);
  const rows = spongeRows(top, box.innerBottom - top, bands.length);
  bands.forEach((color, i) => {
    const row = rows[i];
    if (!row) return;
    const upper = bandEdge(box, row.top, true, xs);
    const lower = bandEdge(box, row.bottom, true, xs);
    g.fillStyle(PALETTE.textLight, 1);
    const creamBottom = rows[i + 1]?.top ?? row.bottom;
    fillPolygon(g, bandPolygon(lower, bandEdge(box, creamBottom, true, xs)));
    g.fillStyle(color, 1);
    fillPolygon(g, bandPolygon(upper, lower));
    if (ctx.sleeping) return;
    const height = row.bottom - row.top;
    const strip = bandEdge(box, row.bottom - height * band.shadowShare, true, xs);
    g.fillStyle(mixColor(color, colors.outline, CREATURE_STYLE.shadowMix), 1);
    fillPolygon(g, bandPolygon(strip, lower));
  });
}

/** Small pores on the sponges, left and right of the face. */
function drawPores(ctx: ArtContext, top: number, count: number): void {
  const { g, box, colors } = ctx;
  const { pores } = band;
  const rows = spongeRows(top, box.innerBottom - top, count);
  const faceHalf = faceHalfSpan(box.width, faceRecipe('rainbow')) + pores.faceGap;
  const perRow = countFor(box.width, pores.perFullWidth) / 2;
  g.fillStyle(colors.outline, pores.alpha);
  rows.forEach((row, r) => {
    const n = Math.max(1, Math.round(perRow));
    for (let i = 0; i < n; i++) {
      const x = spread(
        (i + (r % 2) * 0.5) % n,
        n,
        box.innerLeft + pores.inset,
        box.innerRight - pores.inset,
      );
      if (Math.abs(x) < faceHalf) continue;
      const y = row.top + (row.bottom - row.top) * (0.3 + 0.4 * ((i + r) % 2));
      g.fillCircle(x, y, pores.radius);
    }
  });
}

/**
 * Rainbow cake cut open: five thin coloured sponges with white cream between them and pores, a
 * thin white glaze with a soft wave and drips on top, a gold star on the crown.
 */
export function drawRainbow(ctx: ArtContext, r: Recipe<'rainbow'>): void {
  const { g, box, colors } = ctx;
  const bands = r.bands.map(parseHex);
  drawShadow(g, box);
  if (ctx.sleeping) drawStar(ctx);
  drawBody(g, box, colors);
  const start = box.innerTop + box.height * r.creamShare;
  drawSponges(ctx, bands, start);
  if (!ctx.sleeping) drawPores(ctx, start, bands.length);
  shadeBottom(ctx);
  drawGlaze(g, box, colors, {
    depth: r.creamShare,
    ...rainbowGlaze(),
    avoid: ctx.face,
  });
  if (!ctx.sleeping) {
    const y = box.innerTop + (box.height * r.creamShare) / 2;
    const x0 = box.innerLeft + band.gloss.inset;
    const line = waveLine(x0, x0 + band.gloss.length, y, wave.step).map((p) => [p.x, p.y] as const);
    stroke(g, band.gloss.thick, PALETTE.textLight, band.gloss.alpha, line);
  }
  drawFinish(ctx, 1, { y: start - box.top });
}

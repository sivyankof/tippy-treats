import { faceRecipe } from '../../../data/creature-looks';
import { CREATURE_STYLE } from '../../../data/creature-style';
import { RAINBOW_LOOK } from '../../../data/rainbow-look';
import { PALETTE } from '../../../data/palette';
import { mixColor, parseHex } from '../../../util/color';
import {
  drawGlossMark,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
} from '../../fx/plain-style';
import { faceHalfSpan } from '../../fx/glaze-growth';
import { drawShadow } from '../layer-draw';
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

/** The cream drips of the rainbow layer (the growing drips continue them). */
export const CREAM_DRIP_LENGTH = 14;
export const CREAM_DRIPS = 3;

/** The gold star on the crown: outlined, with a gloss stroke and a dot. Drawn before the body, which hides its foot. */
function drawStar(ctx: ArtContext): void {
  const { g, box } = ctx;
  const cy = box.top - star.lift;
  const fill = ctx.sleeping ? ctx.colors.accent : star.color;
  fillOutlinedPolygon(
    g,
    starPoints(0, cy, star.radius, star.notch),
    fill,
    ctx.sleeping ? ctx.colors.outline : outlineColor(fill),
    star.outline,
  );
  if (ctx.sleeping) return;
  const { gloss } = star;
  drawGlossMark(g, {
    x: gloss.x * star.radius,
    y: cy + gloss.y * star.radius,
    length: gloss.length * star.radius,
    thick: gloss.thick * star.radius,
    tilt: gloss.tilt,
    dotGap: gloss.dotGap,
    dotRadius: gloss.dotRadius,
    color: PALETTE.textLight,
    alpha: 1,
  });
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
  drawStar(ctx);
  drawBody(g, box, colors);
  const start = box.innerTop + box.height * r.creamShare;
  drawSponges(ctx, bands, start);
  if (!ctx.sleeping) drawPores(ctx, start, bands.length);
  shadeBottom(ctx);
  drawGlaze(g, box, colors, {
    depth: r.creamShare,
    dripCount: CREAM_DRIPS,
    dripLength: CREAM_DRIP_LENGTH,
    scallop: { radius: wave.amplitude * 4, step: wave.amplitude * 8 },
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

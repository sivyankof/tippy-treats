import { ANIM } from '../../../data/anim';
import { parseHex, shade } from '../../../util/color';
import { drawGlaze } from '../layer-draw';
import {
  countFor,
  drawBase,
  drawFinish,
  fillBand,
  outlineOf,
  outlinedCircle,
  scatter,
  spread,
  stroke,
  type ArtContext,
  type Recipe,
} from './primitives';

const STRIPE_HALF = 3;
const STRIPE_SHADOW = 2;
const STRIPE_SHADOW_ALPHA = 0.35;
const NUT_WIDTH = 13;
const NUT_HEIGHT = 9;
const NUT_OUTLINE = 2;
const CRACK_WIDTH = 3;
const CRACK_ALPHA = 0.85;
const CRUST_DEPTH = 0.32;
const CHIP_HEIGHT = 13;
const CHIP_MIN_WIDTH = 16;
const CHIP_WIDTH_RANGE = 10;
const CHIP_LIGHT = 0.3;
const RIM_DEPTH = 0.14;
const SPRINKLE_LENGTH = 10;
const SPRINKLE_WIDTH = 4;
const SPRINKLE_CAP = 2;
const ICING_DEPTH = 0.46;
const SIDE_MARGIN = 14;

/** Honey cake: thin cream layers between sponge, dark honey glaze with long drips. */
export function drawHoney(ctx: ArtContext, r: Recipe<'honey'>): void {
  const { g, box, colors } = ctx;
  drawBase(ctx);
  const first = box.top + box.height * ANIM.layer.glazeDepth + 6;
  for (let i = 0; i < r.stripes; i++) {
    const y = spread(i, r.stripes, first, box.innerBottom - 10);
    fillBand(g, box, y - STRIPE_HALF, y + STRIPE_HALF, colors.accent);
    fillBand(
      g,
      box,
      y + STRIPE_HALF,
      y + STRIPE_HALF + STRIPE_SHADOW,
      colors.detail,
      STRIPE_SHADOW_ALPHA,
    );
  }
  drawGlaze(g, box, colors.glaze, { dripCount: r.dripCount, dripLength: r.dripLength });
  drawFinish(ctx);
}

/** Brownie: the darkest body, a crust with light cracks, pieces of nut. */
export function drawBrownie(ctx: ArtContext, r: Recipe<'brownie'>): void {
  const { g, box, colors } = ctx;
  drawBase(ctx);
  drawGlaze(g, box, colors.glaze, { depth: CRUST_DEPTH, dripCount: 0 });

  const cracks = countFor(box.width, r.cracks);
  const crustTop = box.innerTop + 4;
  for (let i = 0; i < cracks; i++) {
    const x = spread(i, cracks, box.innerLeft + SIDE_MARGIN, box.innerRight - SIDE_MARGIN);
    const lean = i % 2 === 0 ? 1 : -1;
    stroke(g, CRACK_WIDTH, colors.accent, CRACK_ALPHA, [
      [x, crustTop],
      [x + 6 * lean, crustTop + 10],
      [x - 4 * lean, crustTop + 20],
      [x + 3 * lean, crustTop + 28],
    ]);
  }

  const nuts = countFor(box.width, r.nuts);
  const bodyTop = box.top + box.height * CRUST_DEPTH + 8;
  for (let i = 0; i < nuts; i++) {
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.1) * (box.innerW - SIDE_MARGIN * 2);
    const y = bodyTop + scatter(i, 0.45) * (box.innerBottom - 8 - bodyTop);
    g.fillStyle(outlineOf(colors.detail), 1);
    g.fillEllipse(x, y, NUT_WIDTH + NUT_OUTLINE * 2, NUT_HEIGHT + NUT_OUTLINE * 2);
    g.fillStyle(colors.detail, 1);
    g.fillEllipse(x, y, NUT_WIDTH, NUT_HEIGHT);
  }
  drawFinish(ctx);
}

/** Cookie: a bumpy edge above the layer and dark chocolate chips. */
export function drawCrumb(ctx: ArtContext, r: Recipe<'crumb'>): void {
  const { g, box, colors } = ctx;
  const { outline } = ANIM.layer;
  const lighter = shade(colors.body, ANIM.layer.gradientLift);
  const bumps = countFor(box.width, r.bumps);
  // Bumps first: the body covers their lower halves.
  for (let i = 0; i < bumps; i++) {
    const x = spread(i, bumps, box.left + box.radius, box.right - box.radius);
    const radius = r.bumpRadius * (0.85 + 0.3 * scatter(i, 0.2));
    outlinedCircle(g, x, box.top + outline, radius, lighter, outlineOf(colors.body), outline);
  }
  drawBase(ctx);
  drawGlaze(g, box, colors.glaze, { depth: RIM_DEPTH, dripCount: 0 });

  const chips = countFor(box.width, r.chips);
  for (let i = 0; i < chips; i++) {
    const w = CHIP_MIN_WIDTH + CHIP_WIDTH_RANGE * scatter(i, 0.7);
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.1) * (box.innerW - SIDE_MARGIN * 2);
    const y = box.innerTop + 16 + scatter(i, 0.5) * (box.innerH - 34);
    g.fillStyle(colors.accent, 1);
    g.fillRoundedRect(x - w / 2, y - CHIP_HEIGHT / 2, w, CHIP_HEIGHT, 3);
    g.fillStyle(shade(colors.accent, CHIP_LIGHT), 0.8);
    g.fillRoundedRect(x - w / 2 + 2, y - CHIP_HEIGHT / 2 + 1.5, w / 2, 2.5, 1);
  }
  drawFinish(ctx);
}

/** Doughnut: sandy body, pink icing with a wavy edge and coloured sprinkles. */
export function drawSprinkle(ctx: ArtContext, r: Recipe<'sprinkle'>): void {
  const { g, box, colors } = ctx;
  drawBase(ctx);
  drawGlaze(g, box, colors.glaze, {
    depth: ICING_DEPTH,
    dripCount: 0,
    scallop: { radius: r.scallopRadius, step: r.scallopRadius * 2 },
  });

  const palette = r.sprinkleColors.map(parseHex);
  const count = countFor(box.width, r.sprinkles);
  const bottom = box.top + box.height * ICING_DEPTH - 8;
  for (let i = 0; i < count; i++) {
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.2) * (box.innerW - SIDE_MARGIN * 2);
    const y = box.innerTop + 8 + scatter(i, 0.6) * (bottom - box.innerTop - 8);
    const angle = scatter(i, 0.9) * Math.PI;
    const dx = (Math.cos(angle) * SPRINKLE_LENGTH) / 2;
    const dy = (Math.sin(angle) * SPRINKLE_LENGTH) / 2;
    const color = palette[i % palette.length] ?? colors.accent;
    stroke(g, SPRINKLE_WIDTH, color, 1, [
      [x - dx, y - dy],
      [x + dx, y + dy],
    ]);
    g.fillStyle(color, 1);
    g.fillCircle(x - dx, y - dy, SPRINKLE_CAP);
    g.fillCircle(x + dx, y + dy, SPRINKLE_CAP);
  }
  drawFinish(ctx);
}

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
/** Honey stripes: gap under the glaze and above the bottom edge. */
const STRIPE_TOP_GAP = 6;
const STRIPE_BOTTOM_GAP = 10;
/** Brownie cracks: start below the crust edge and zigzag down by these steps (x lean, y). */
const CRUST_TOP_GAP = 4;
const CRACK_ZIGZAG: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [6, 10],
  [-4, 20],
  [3, 28],
];
/** Gap between the crust and the first nut, and between the last nut and the bottom edge. */
const NUT_TOP_GAP = 8;
const NUT_BOTTOM_GAP = 8;
/** Cookie chips keep this far from the top edge and this much from the bottom (total). */
const CHIP_TOP_GAP = 16;
const CHIP_VERTICAL_MARGIN = 34;
const CHIP_CORNER = 3;
/** The highlight on a chip: inset from its left and top, height and corner. */
const CHIP_SHINE_INSET_X = 2;
const CHIP_SHINE_INSET_Y = 1.5;
const CHIP_SHINE_HEIGHT = 2.5;
const CHIP_SHINE_CORNER = 1;
const CHIP_SHINE_ALPHA = 0.8;
/** Sprinkles stay this far from the top edge and from the bottom of the icing. */
const SPRINKLE_GAP = 8;

/** Honey cake: thin cream layers between sponge, dark honey glaze with long drips. */
export function drawHoney(ctx: ArtContext, r: Recipe<'honey'>): void {
  const { g, box, colors } = ctx;
  drawBase(ctx);
  const first = box.top + box.height * ANIM.layer.glazeDepth + STRIPE_TOP_GAP;
  for (let i = 0; i < r.stripes; i++) {
    const y = spread(i, r.stripes, first, box.innerBottom - STRIPE_BOTTOM_GAP);
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
  const crustTop = box.innerTop + CRUST_TOP_GAP;
  for (let i = 0; i < cracks; i++) {
    const x = spread(i, cracks, box.innerLeft + SIDE_MARGIN, box.innerRight - SIDE_MARGIN);
    const lean = i % 2 === 0 ? 1 : -1;
    stroke(
      g,
      CRACK_WIDTH,
      colors.accent,
      CRACK_ALPHA,
      CRACK_ZIGZAG.map(([dx, dy]) => [x + dx * lean, crustTop + dy] as const),
    );
  }

  const nuts = countFor(box.width, r.nuts);
  const bodyTop = box.top + box.height * CRUST_DEPTH + NUT_TOP_GAP;
  for (let i = 0; i < nuts; i++) {
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.1) * (box.innerW - SIDE_MARGIN * 2);
    const y = bodyTop + scatter(i, 0.45) * (box.innerBottom - NUT_BOTTOM_GAP - bodyTop);
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
    const y = box.innerTop + CHIP_TOP_GAP + scatter(i, 0.5) * (box.innerH - CHIP_VERTICAL_MARGIN);
    g.fillStyle(colors.accent, 1);
    g.fillRoundedRect(x - w / 2, y - CHIP_HEIGHT / 2, w, CHIP_HEIGHT, CHIP_CORNER);
    g.fillStyle(shade(colors.accent, CHIP_LIGHT), CHIP_SHINE_ALPHA);
    g.fillRoundedRect(
      x - w / 2 + CHIP_SHINE_INSET_X,
      y - CHIP_HEIGHT / 2 + CHIP_SHINE_INSET_Y,
      w / 2,
      CHIP_SHINE_HEIGHT,
      CHIP_SHINE_CORNER,
    );
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
  const bottom = box.top + box.height * ICING_DEPTH - SPRINKLE_GAP;
  for (let i = 0; i < count; i++) {
    const x = box.innerLeft + SIDE_MARGIN + scatter(i, 0.2) * (box.innerW - SIDE_MARGIN * 2);
    const y =
      box.innerTop + SPRINKLE_GAP + scatter(i, 0.6) * (bottom - box.innerTop - SPRINKLE_GAP);
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

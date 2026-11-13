import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { PALETTE } from '../../data/palette';
import { mixColor, shade } from '../../util/color';

/** Outline of a body: its fill darkened by this much. */
export const DARK_OUTLINE = -0.38;
const GLAZE_OUTLINE = -0.22;
const PORE_SHADE = -0.3;
/** Pores sit between these shares of the sponge strip width, measured from the cut edge. */
const PORE_NEAR = 0.3;
const PORE_FAR = 0.7;
/** Golden ratio step: spreads the pores evenly without a random generator. */
export const GOLDEN_STEP = 0.618;
const DRIP_WIDTH = 22;
const DRIP_MIN_LAYER_WIDTH = 120;
const DRIP_SHORT_RATIO = 0.65;
const GLOSS_HEIGHT = 10;
const GLOSS_INSET = 26;
const GLOSS_LENGTH_RATIO = 0.5;
export const SHADOW_DROP = 6;
const SHADOW_WIDTH_RATIO = 0.96;
const RIM_SHARE = 0.26;

/** Geometry of one layer around its centre (0, 0): outer shape and the area inside the outline. */
export interface LayerBox {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  radius: number;
  innerLeft: number;
  innerTop: number;
  innerRight: number;
  innerBottom: number;
  innerW: number;
  innerH: number;
  innerRadius: number;
}

export function layerBox(width: number): LayerBox {
  const h = BALANCE.layer.height;
  const { outline, cornerRadius } = ANIM.layer;
  const radius = Math.min(cornerRadius, width / 2, h / 2);
  const innerW = Math.max(0, width - outline * 2);
  const innerH = h - outline * 2;
  return {
    width,
    height: h,
    left: -width / 2,
    top: -h / 2,
    right: width / 2,
    bottom: h / 2,
    radius,
    innerLeft: -width / 2 + outline,
    innerTop: -h / 2 + outline,
    innerRight: -width / 2 + outline + innerW,
    innerBottom: -h / 2 + outline + innerH,
    innerW,
    innerH,
    innerRadius: Math.max(0, radius - outline),
  };
}

/**
 * Top-anchored stack of bands, lighter towards the top. The bands are nested
 * from tall to short, so the colour changes from `bottom` to `top` going up.
 * Band bottoms are square, which only shows below the rounded top corners.
 */
export function fillGradient(
  g: Phaser.GameObjects.Graphics,
  box: { x: number; y: number; width: number; height: number },
  radius: number,
  bottom: number,
  top: number,
  bands: number,
): void {
  const minHeight = Math.min(box.height, radius);
  const corners = { tl: radius, tr: radius, bl: 0, br: 0 };
  for (let k = 0; k < bands; k++) {
    const t = bands === 1 ? 0 : k / (bands - 1);
    const height = minHeight + (box.height - minHeight) * (1 - k / bands);
    g.fillStyle(mixColor(bottom, top, t), 1);
    g.fillRoundedRect(box.x, box.y, box.width, height, corners);
  }
}

export interface GlazeOptions {
  /** Share of the layer height; `ANIM.layer.glazeDepth` when left out. */
  depth?: number;
  dripCount?: number;
  dripLength?: number;
  /** A wavy lower edge of circles instead of drips. */
  scallop?: { radius: number; step: number };
}

/** Glaze on the top of the layer with drips hanging from its lower edge. */
export function drawGlaze(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  glaze: number,
  options: GlazeOptions = {},
): void {
  const { outline, glazeDepth, dripCount, dripLength, gradientLift, glazeBands } = ANIM.layer;
  const depth = options.depth ?? glazeDepth;
  const drips = options.dripCount ?? dripCount;
  const length = options.dripLength ?? dripLength;
  const glazeH = box.height * depth;
  const withDrips = box.width >= DRIP_MIN_LAYER_WIDTH && drips > 0;
  const topCorners = { tl: box.innerRadius, tr: box.innerRadius, bl: 0, br: 0 };

  // Two passes so every outline sits under every fill.
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    if (pass === 'outline') {
      g.fillStyle(shade(glaze, GLAZE_OUTLINE), 1);
      g.fillRoundedRect(
        box.innerLeft - grow,
        box.innerTop - grow,
        box.innerW + grow * 2,
        glazeH + grow,
        topCorners,
      );
    } else {
      fillGradient(
        g,
        { x: box.innerLeft, y: box.innerTop, width: box.innerW, height: glazeH },
        box.innerRadius,
        glaze,
        shade(glaze, gradientLift),
        glazeBands,
      );
    }
    if (options.scallop) {
      const { radius, step } = options.scallop;
      const x0 = box.innerLeft + box.innerRadius;
      const x1 = box.innerRight - box.innerRadius;
      const count = Math.max(1, Math.round((x1 - x0) / step));
      g.fillStyle(pass === 'outline' ? shade(glaze, GLAZE_OUTLINE) : glaze, 1);
      for (let i = 0; i < count; i++) {
        g.fillCircle(x0 + ((x1 - x0) * (i + 0.5)) / count, box.innerTop + glazeH, radius + grow);
      }
    }
    if (!withDrips) continue;
    g.fillStyle(pass === 'outline' ? shade(glaze, GLAZE_OUTLINE) : glaze, 1);
    for (let i = 0; i < drips; i++) {
      const cx = box.left + (box.width * (i + 1)) / (drips + 1);
      const dripH = i % 2 === 0 ? length : length * DRIP_SHORT_RATIO;
      const w = DRIP_WIDTH + grow * 2;
      g.fillRoundedRect(
        cx - w / 2,
        box.innerTop + glazeH - DRIP_WIDTH / 2,
        w,
        dripH + DRIP_WIDTH / 2 + grow,
        w / 2,
      );
    }
  }
}

/**
 * Porous sponge on the cut side: a lighter strip along the inner side of the edge,
 * over the glaze too, with a few darker pores. Drawn inside the outline.
 */
export function drawSponge(
  g: Phaser.GameObjects.Graphics,
  cut: CutSide,
  cake: number,
  box: LayerBox,
): void {
  const { width, lift, poreCount, poreRadius, poreAlpha } = ANIM.layer.sponge;
  const stripW = Math.min(width, box.innerW / 2);
  if (stripW <= 0) return;
  const sign = cut === 'left' ? 1 : -1;
  const edgeX = cut === 'left' ? box.innerLeft : box.innerRight;
  const stripLeft = cut === 'left' ? edgeX : edgeX - stripW;
  const r = box.innerRadius;
  const corners = cut === 'left' ? { tl: r, tr: 0, bl: r, br: 0 } : { tl: 0, tr: r, bl: 0, br: r };

  g.fillStyle(shade(cake, lift), 1);
  g.fillRoundedRect(stripLeft, box.innerTop, stripW, box.innerH, corners);

  g.fillStyle(shade(cake, PORE_SHADE), poreAlpha);
  for (let i = 0; i < poreCount; i++) {
    const y = box.innerTop + (box.innerH * (i + 0.5)) / poreCount;
    const along = PORE_NEAR + (PORE_FAR - PORE_NEAR) * ((i * GOLDEN_STEP) % 1);
    g.fillCircle(edgeX + sign * stripW * along, y, poreRadius);
  }
}

/** Soft shadow ellipse under the layer. */
export function drawShadow(g: Phaser.GameObjects.Graphics, box: LayerBox): void {
  g.fillStyle(PALETTE.textDark, ANIM.layer.shadowAlpha);
  g.fillEllipse(
    0,
    box.bottom + SHADOW_DROP,
    box.width * SHADOW_WIDTH_RATIO,
    ANIM.layer.shadowHeight,
  );
}

/** Dark outline, darker rim at the bottom and a gradient of `cake` above it. */
export function drawBody(g: Phaser.GameObjects.Graphics, box: LayerBox, cake: number): void {
  const { rimAlpha, bodyBands, gradientLift } = ANIM.layer;
  g.fillStyle(shade(cake, DARK_OUTLINE), 1);
  g.fillRoundedRect(box.left, box.top, box.width, box.height, box.radius);
  g.fillStyle(shade(cake, -rimAlpha), 1);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, box.innerH, box.innerRadius);
  fillGradient(
    g,
    { x: box.innerLeft, y: box.innerTop, width: box.innerW, height: box.innerH * (1 - RIM_SHARE) },
    box.innerRadius,
    cake,
    shade(cake, gradientLift),
    bodyBands,
  );
}

/** The white highlight in the upper third. */
export function drawGloss(g: Phaser.GameObjects.Graphics, box: LayerBox): void {
  const glossW = Math.max(0, box.width * GLOSS_LENGTH_RATIO - GLOSS_INSET);
  if (glossW <= 0) return;
  g.fillStyle(PALETTE.textLight, ANIM.layer.glossAlpha);
  g.fillRoundedRect(
    box.left + GLOSS_INSET,
    box.top + ANIM.layer.outline + GLOSS_HEIGHT,
    glossW,
    GLOSS_HEIGHT,
    GLOSS_HEIGHT / 2,
  );
}

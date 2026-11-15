import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { PALETTE } from '../../data/palette';
import { mixColor, shade } from '../../util/color';

/** Outline of a body: its fill darkened by this much. */
export const DARK_OUTLINE = -0.38;
/** Outline of the glaze and its drips: the glaze darkened by this much. */
export const GLAZE_OUTLINE = -0.22;
const PORE_SHADE = -0.3;
/** Pores sit between these shares of the sponge strip width, measured from the cut edge. */
const PORE_NEAR = 0.3;
const PORE_FAR = 0.7;
/** Golden ratio step: spreads the pores evenly without a random generator. */
export const GOLDEN_STEP = 0.618;
/** Width of a glaze drip and the narrowest layer that gets drips. */
export const DRIP_WIDTH = 22;
export const DRIP_MIN_LAYER_WIDTH = 120;
const DRIP_SHORT_RATIO = 0.65;
export const SHADOW_DROP = 6;
const SHADOW_WIDTH_RATIO = 0.96;

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
  /** Drips and scallops that would touch this box are left out (the closed eyes of a sleeper). */
  avoid?: Rect | undefined;
}

/** A box around the layer centre: x and y ranges in pixels. */
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function touches(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** One drip hanging from the glaze: its centre x and the length of the baked part below the glaze. */
export interface DripSpot {
  x: number;
  length: number;
}

/** Where the baked drips of a layer hang (none on a narrow layer): evenly spread, long and short in turn. */
export function dripSpots(box: LayerBox, count: number, length: number): DripSpot[] {
  if (box.width < DRIP_MIN_LAYER_WIDTH || count <= 0) return [];
  const spots: DripSpot[] = [];
  for (let i = 0; i < count; i++) {
    spots.push({
      x: box.left + (box.width * (i + 1)) / (count + 1),
      length: i % 2 === 0 ? length : length * DRIP_SHORT_RATIO,
    });
  }
  return spots;
}

/** The baked glaze of a layer: where its lower edge is, the scallop circles hanging from it and its drips. */
export interface GlazeLayout {
  edgeY: number;
  scallops: Array<{ x: number; radius: number }>;
  drips: DripSpot[];
}

/**
 * Where the glaze of a layer reaches: the one place the picture and whatever keeps clear of it
 * (the rainbow wave) read. Drips and scallops that would touch `options.avoid` are left out.
 */
export function glazeLayout(box: LayerBox, options: GlazeOptions = {}): GlazeLayout {
  const { glazeDepth, dripCount, dripLength } = ANIM.layer;
  const depth = options.depth ?? glazeDepth;
  const { avoid } = options;
  const clear = (rect: Rect): boolean => !avoid || !touches(rect, avoid);
  const edgeY = box.innerTop + box.height * depth;
  const drips = dripSpots(
    box,
    options.dripCount ?? dripCount,
    options.dripLength ?? dripLength,
  ).filter((d) =>
    clear({
      left: d.x - DRIP_WIDTH / 2,
      right: d.x + DRIP_WIDTH / 2,
      top: edgeY,
      bottom: edgeY + d.length + DRIP_WIDTH / 2,
    }),
  );
  const scallops: GlazeLayout['scallops'] = [];
  if (options.scallop) {
    const { radius, step } = options.scallop;
    const x0 = box.innerLeft + box.innerRadius;
    const x1 = box.innerRight - box.innerRadius;
    const count = Math.max(1, Math.round((x1 - x0) / step));
    for (let i = 0; i < count; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / count;
      if (
        clear({ left: x - radius, right: x + radius, top: edgeY - radius, bottom: edgeY + radius })
      ) {
        scallops.push({ x, radius });
      }
    }
  }
  return { edgeY, scallops, drips };
}

/** Y of the lower edge of the glaze (the top of every drip), around the layer centre. */
export function glazeBottomY(box: LayerBox, depth: number = ANIM.layer.glazeDepth): number {
  return box.innerTop + box.height * depth;
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

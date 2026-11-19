import type * as Phaser from 'phaser';
import type { CutSide } from '../../../core/drop';
import { BALANCE } from '../../../data/tower/balance';
import type { ArtRecipe } from '../../../data/creatures/creature-looks';
import {
  CREATURES,
  type CreatureId,
  type CreaturePalette,
} from '../../../data/creatures/creatures';
import { CREATURE_STYLE } from '../../../data/creatures/creature-style';
import { mixColor, parseHex, shade } from '../../../util/color';
import {
  GLAZE_OUTLINE,
  GOLDEN_STEP,
  drawShadow,
  drawSponge,
  type LayerBox,
  type Rect,
} from '../layer-draw';
import { drawBody, drawGloss, type GlossSpot } from './flat-draw';

export type Graphics = Phaser.GameObjects.Graphics;

/** The recipe of one creature kind. */
export type Recipe<K extends ArtRecipe['kind']> = Extract<ArtRecipe, { kind: K }>;

/** Palette of a creature as 0xRRGGBB numbers. */
export interface CreatureColors {
  body: number;
  glaze: number;
  accent: number;
  detail: number;
  sponge: number;
  /** Outline of the body and of the details above it. */
  outline: number;
  /** The flat shadow tone of the body. */
  shadow: number;
  /** Outline and shadow tone of the glaze. */
  glazeOutline: number;
  glazeShadow: number;
}

const colorCache = new Map<CreatureId, CreatureColors>();

/** The drawing colours of a palette: the flat shadow and the glaze tones are derived from it. */
export function colorsOf(p: CreaturePalette): CreatureColors {
  const body = parseHex(p.body);
  const glaze = parseHex(p.glaze);
  const outline = parseHex(p.outline);
  const glazeOutline = mixColor(
    shade(glaze, GLAZE_OUTLINE),
    outline,
    CREATURE_STYLE.glaze.outlineMix,
  );
  return {
    body,
    glaze,
    accent: parseHex(p.accent),
    detail: parseHex(p.detail),
    sponge: parseHex(p.sponge),
    outline,
    shadow: p.shadow ? parseHex(p.shadow) : mixColor(body, outline, CREATURE_STYLE.shadowMix),
    glazeOutline,
    glazeShadow: mixColor(glaze, glazeOutline, CREATURE_STYLE.glaze.shadowMix),
  };
}

export function creatureColors(id: CreatureId): CreatureColors {
  let colors = colorCache.get(id);
  if (!colors) {
    colors = colorsOf(CREATURES[id].palette);
    colorCache.set(id, colors);
  }
  return colors;
}

/** What a creature drawer gets: where to draw and with what. */
export interface ArtContext {
  g: Graphics;
  box: LayerBox;
  colors: CreatureColors;
  cut: CutSide | null;
  /** A sleeping silhouette: no gloss and no inner pattern that would show colours of its own. */
  sleeping: boolean;
  /** Where the closed eyes of a sleeper are: glaze edges and chips keep off it so the eyes stay readable. */
  face?: Rect;
}

/** Circle with the dark outline of its own colour. */
export function outlinedCircle(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  fill: number,
  outline: number,
  line: number,
): void {
  g.fillStyle(outline, 1);
  g.fillCircle(x, y, radius + line);
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, radius);
}

/** `count` positions evenly spread from `from` to `to`, each in the middle of its slot. */
export function spread(index: number, count: number, from: number, to: number): number {
  return from + ((to - from) * (index + 0.5)) / count;
}

/** The fractional part of `index * golden ratio`: a stable stand-in for a random number in 0..1. */
export function scatter(index: number, offset = 0): number {
  return (index * GOLDEN_STEP + offset) % 1;
}

/**
 * How far the rounded corners of the body cut into a horizontal band at height `y`
 * (0 on the straight part of the sides).
 */
export function cornerInset(box: LayerBox, y: number): number {
  const r = box.innerRadius;
  const fromEdge = Math.min(y - box.innerTop, box.innerBottom - y);
  if (r <= 0 || fromEdge >= r) return 0;
  const dy = r - Math.max(0, fromEdge);
  return r - Math.sqrt(Math.max(0, r * r - dy * dy));
}

/** A horizontal band across the body from `y0` to `y1`, kept inside the rounded corners. */
export function fillBand(
  g: Graphics,
  box: LayerBox,
  y0: number,
  y1: number,
  color: number,
  alpha = 1,
): void {
  const top = Math.max(y0, box.innerTop);
  const bottom = Math.min(y1, box.innerBottom);
  if (bottom <= top) return;
  const inset = Math.max(cornerInset(box, top), cornerInset(box, bottom));
  const w = box.innerW - inset * 2;
  if (w <= 0) return;
  g.fillStyle(color, alpha);
  g.fillRect(box.innerLeft + inset, top, w, bottom - top);
}

/** A row of circles along a line, as a wavy edge: outlines first, then the fills. */
export function scallops(
  g: Graphics,
  x0: number,
  x1: number,
  y: number,
  radius: number,
  step: number,
  fill: number,
  outline: number,
  line: number,
): void {
  const count = Math.max(1, Math.round((x1 - x0) / step));
  for (const pass of ['outline', 'fill'] as const) {
    g.fillStyle(pass === 'outline' ? outline : fill, 1);
    for (let i = 0; i < count; i++) {
      const x = spread(i, count, x0, x1);
      g.fillCircle(x, y, pass === 'outline' ? radius + line : radius);
    }
  }
}

/** Line of a given colour and thickness. */
export function stroke(
  g: Graphics,
  width: number,
  color: number,
  alpha: number,
  points: ReadonlyArray<readonly [number, number]>,
): void {
  const first = points[0];
  if (!first) return;
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(first[0], first[1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.strokePath();
}

/** Shadow and the flat two-tone body in the colour of the creature. */
export function drawBase(ctx: ArtContext): void {
  drawShadow(ctx.g, ctx.box);
  drawBody(ctx.g, ctx.box, ctx.colors);
}

/** The cut sponge in the creature's own colours, then the gloss (`glossScale` makes it bigger). */
export function drawFinish(ctx: ArtContext, glossScale = 1, spot: GlossSpot = {}): void {
  if (ctx.cut) drawSponge(ctx.g, ctx.cut, ctx.colors.sponge, ctx.box);
  if (ctx.sleeping) return;
  drawGloss(ctx.g, ctx.box, glossScale, spot);
}

/** The shadow band laid over a pattern that covers the bottom of the body. */
export function shadeBottom(ctx: ArtContext): void {
  const { box, colors } = ctx;
  const band = box.innerH * CREATURE_STYLE.shadowShare;
  ctx.g.fillStyle(colors.outline, CREATURE_STYLE.coverShadowAlpha);
  ctx.g.fillRoundedRect(box.innerLeft, box.innerBottom - band, box.innerW, band, {
    tl: 0,
    tr: 0,
    bl: box.innerRadius,
    br: box.innerRadius,
  });
}

/**
 * How many things of a pattern fit a layer of this width, when `perFullWidth` fit the widest layer.
 * Counting by width keeps the density the same when the layer is bitten narrower.
 */
export function countFor(width: number, perFullWidth: number): number {
  return Math.max(1, Math.round((perFullWidth * width) / BALANCE.layer.maxWidth));
}

import type * as Phaser from 'phaser';
import type { CutSide } from '../../../core/drop';
import { BALANCE } from '../../../data/balance';
import type { ArtRecipe } from '../../../data/creature-looks';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { parseHex, shade } from '../../../util/color';
import {
  DARK_OUTLINE,
  GOLDEN_STEP,
  drawBody,
  drawGloss,
  drawShadow,
  drawSponge,
  type LayerBox,
} from '../layer-draw';

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
}

const colorCache = new Map<CreatureId, CreatureColors>();

export function creatureColors(id: CreatureId): CreatureColors {
  let colors = colorCache.get(id);
  if (!colors) {
    const p = CREATURES[id].palette;
    colors = {
      body: parseHex(p.body),
      glaze: parseHex(p.glaze),
      accent: parseHex(p.accent),
      detail: parseHex(p.detail),
      sponge: parseHex(p.sponge),
    };
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
}

/** Outline colour of a fill. */
export function outlineOf(fill: number): number {
  return shade(fill, DARK_OUTLINE);
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
  line: number,
): void {
  const count = Math.max(1, Math.round((x1 - x0) / step));
  for (const pass of ['outline', 'fill'] as const) {
    g.fillStyle(pass === 'outline' ? outlineOf(fill) : fill, 1);
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

/** Shadow and the plain body in the colour of the creature (or `cake`). */
export function drawBase(ctx: ArtContext, cake: number = ctx.colors.body): void {
  drawShadow(ctx.g, ctx.box);
  drawBody(ctx.g, ctx.box, cake);
}

/** The cut sponge in the creature's own colours, then the gloss. */
export function drawFinish(ctx: ArtContext): void {
  if (ctx.cut) drawSponge(ctx.g, ctx.cut, ctx.colors.sponge, ctx.box);
  drawGloss(ctx.g, ctx.box);
}

/**
 * How many things of a pattern fit a layer of this width, when `perFullWidth` fit the widest layer.
 * Counting by width keeps the density the same when the layer is bitten narrower.
 */
export function countFor(width: number, perFullWidth: number): number {
  return Math.max(1, Math.round((perFullWidth * width) / BALANCE.layer.maxWidth));
}

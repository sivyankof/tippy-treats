import type * as Phaser from 'phaser';
import { CLIMB_LANDSCAPE } from '../../../data/progression/climb-landscape';
import { shade } from '../../../util/color';
import {
  drawGlossMark,
  ellipsePoints,
  fillPolygon,
  outlineColor,
  roundRectPoints,
  type BodyShape,
  type Pt,
} from '../common/plain-style';

type Graphics = Phaser.GameObjects.Graphics;

const L = CLIMB_LANDSCAPE;

/** What a picture of the ribbon is drawn with: the graphics, its size and the colour filter (the fog turns it into a silhouette). */
export interface LandCtx {
  g: Graphics;
  width: number;
  height: number;
  /** Maps every colour the drawing uses; the identity for an open picture. */
  c: (color: number) => number;
}

/** One body of a group: an outline shape and its box. */
export interface Part {
  shape: BodyShape;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export const round =
  (share = 0.35): BodyShape =>
  (cx, cy, rx, ry) =>
    roundRectPoints(cx, cy, rx, ry, Math.min(rx, ry) * share * 2);

export const oval: BodyShape = (cx, cy, rx, ry) => ellipsePoints(cx, cy, rx, ry, 0);

/** A rounded box by its top-left corner. */
export function box(x: number, y: number, w: number, h: number, share = 0.35): Part {
  return { shape: round(share), cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 };
}

export function disc(cx: number, cy: number, r: number): Part {
  return { shape: oval, cx, cy, rx: r, ry: r };
}

export function ovalPart(cx: number, cy: number, rx: number, ry: number): Part {
  return { shape: oval, cx, cy, rx, ry };
}

/**
 * One silhouette of the manner built of several bodies: every outline first, then every shadow
 * tone, then the lit tones pushed to the top left, so the bodies read as one flat shape with a
 * single warm outline round it (the same order the zone emblems use).
 */
export function drawGroup(
  ctx: LandCtx,
  parts: readonly Part[],
  fill: number,
  grow: number = L.outline,
): void {
  const { g, c } = ctx;
  const dark = c(outlineColor(fill));
  g.fillStyle(dark, 1);
  for (const p of parts) fillPolygon(g, p.shape(p.cx, p.cy, p.rx + grow, p.ry + grow));
  g.fillStyle(c(shade(fill, L.shadowShade)), 1);
  for (const p of parts) fillPolygon(g, p.shape(p.cx, p.cy, p.rx, p.ry));
  g.fillStyle(c(fill), 1);
  for (const p of parts) {
    fillPolygon(
      g,
      p.shape(p.cx - p.rx * L.band, p.cy - p.ry * L.band, p.rx * (1 - L.band), p.ry * (1 - L.band)),
    );
  }
}

/** One body of the manner. */
export function drawBody(ctx: LandCtx, part: Part, fill: number, grow: number = L.outline): void {
  drawGroup(ctx, [part], fill, grow);
}

/** A flat polygon with a warm outline of its own colour (mountains, roof) and an optional shadow part. */
export function drawPoly(
  ctx: LandCtx,
  pts: readonly Pt[],
  fill: number,
  shadowPts?: readonly Pt[],
  shadow?: number,
  grow: number = L.outline,
): void {
  const { g, c } = ctx;
  g.fillStyle(c(outlineColor(shadow ?? fill)), 1);
  // The outline is the polygon drawn pushed out in eight directions.
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    fillPolygon(
      g,
      pts.map((p) => ({ x: p.x + Math.cos(a) * grow, y: p.y + Math.sin(a) * grow })),
    );
  }
  g.fillStyle(c(fill), 1);
  fillPolygon(g, pts);
  if (shadowPts && shadow !== undefined) {
    g.fillStyle(c(shadow), 1);
    fillPolygon(g, shadowPts);
  }
}

/** The gloss mark of the manner: a short white stroke and a dot. */
export function gloss(ctx: LandCtx, x: number, y: number, length: number, alpha = 0.8): void {
  drawGlossMark(ctx.g, {
    x,
    y,
    length,
    thick: length * 0.28,
    tilt: -0.5,
    dotGap: length * 0.38,
    dotRadius: length * 0.12,
    color: ctx.c(0xffffff),
    alpha,
  });
}

/** A cartoon cloud: a flat bottom and round humps, one silhouette. */
export function cloudParts(cx: number, cy: number, s: number): Part[] {
  return [
    disc(cx - 54 * s, cy + 8 * s, 30 * s),
    disc(cx - 18 * s, cy - 14 * s, 40 * s),
    disc(cx + 28 * s, cy - 6 * s, 34 * s),
    disc(cx + 60 * s, cy + 12 * s, 26 * s),
    box(cx - 84 * s, cy + 2 * s, 170 * s, 38 * s, 0.5),
  ];
}

export function drawCloud(ctx: LandCtx, cx: number, cy: number, s: number, fill: number): void {
  drawGroup(ctx, cloudParts(cx, cy, s), fill, L.outline);
  gloss(ctx, cx - 26 * s, cy - 24 * s, 24 * s);
}

/** A four-pointed sparkle. */
export function drawSparkle(
  ctx: LandCtx,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha = 1,
): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const k = i % 2 === 0 ? r : r * 0.26;
    pts.push({ x: cx + Math.cos(a) * k, y: cy + Math.sin(a) * k });
  }
  ctx.g.fillStyle(ctx.c(color), alpha);
  fillPolygon(ctx.g, pts);
}

/** A padlock: a body with a keyhole and an arch above it. */
export function drawLock(ctx: LandCtx, cx: number, cy: number, size: number, fill: number): void {
  const { g, c } = ctx;
  const w = size * 0.8;
  const h = size * 0.6;
  const arch = size * 0.3;
  g.lineStyle(size * 0.15 + L.outline * 1.6, c(outlineColor(fill)), 1);
  g.beginPath();
  g.arc(cx, cy - h * 0.1, arch, Math.PI, 0, false);
  g.strokePath();
  g.lineStyle(size * 0.15, c(shade(fill, 0.35)), 1);
  g.beginPath();
  g.arc(cx, cy - h * 0.1, arch, Math.PI, 0, false);
  g.strokePath();
  drawBody(ctx, box(cx - w / 2, cy - h * 0.1, w, h, 0.3), fill, L.outline * 0.8);
  g.fillStyle(c(outlineColor(fill)), 1);
  g.fillCircle(cx, cy + h * 0.18, size * 0.07);
  g.fillRect(cx - size * 0.03, cy + h * 0.18, size * 0.06, size * 0.14);
}

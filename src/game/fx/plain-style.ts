import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { DEG_TO_RAD, TWO_PI } from '../../util/math';
import { luma, shade } from '../../util/color';
import { TOWER_WEATHER } from '../../data/tower-weather';
import { DARK_OUTLINE } from '../objects/layer-draw';

/** Outline thickness of the plain layers as a share of their height; icons use the same share of theirs. */
export const OUTLINE_SHARE = ANIM.layer.outline / BALANCE.layer.height;

/** The warm dark outline of a body filled with `fill`, the tone the layers use. */
export function outlineColor(fill: number): number {
  return shade(fill, DARK_OUTLINE);
}

/** The tint of a sleepy eyelid over the crust `crust`: the crust itself, lifted a little when it is very dark. */
export function sleepyLidTone(crust: number): number {
  const { minLuma, maxLift } = TOWER_WEATHER.sleepy.lid;
  const dark = Math.max(0, (minLuma - luma(crust)) / minLuma);
  return shade(crust, maxLift * dark);
}

export interface Pt {
  x: number;
  y: number;
}

/** Fills a closed outline of points with one path. */
export function fillPolygon(g: Phaser.GameObjects.Graphics, points: readonly Pt[]): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of rest) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
}

/**
 * Fills the band between two polylines of equal length as triangles. Same picture as
 * `fillPolygon` of one edge followed by the other reversed, without the per-frame
 * triangulation of a long thin outline that a path fill does.
 */
export function fillRibbon(
  g: Phaser.GameObjects.Graphics,
  edgeA: readonly Pt[],
  edgeB: readonly Pt[],
): void {
  const count = Math.min(edgeA.length, edgeB.length);
  for (let i = 1; i < count; i++) {
    const a0 = edgeA[i - 1] as Pt;
    const a1 = edgeA[i] as Pt;
    const b0 = edgeB[i - 1] as Pt;
    const b1 = edgeB[i] as Pt;
    g.fillTriangle(a0.x, a0.y, b0.x, b0.y, a1.x, a1.y);
    g.fillTriangle(a1.x, a1.y, b0.x, b0.y, b1.x, b1.y);
  }
}

/** Fills a convex quadrilateral (corners in order) as two triangles. */
export function fillQuad(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, c: Pt, d: Pt): void {
  g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  g.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
}

/** Directions the outline of a small shape is pushed in to make it thicker all round. */
const OUTLINE_DIRECTIONS = 8;

/**
 * A closed shape with a thick outline of its own: the shape is drawn pushed `grow` pixels in
 * eight directions in `outline`, then once in `fill`. For small details (a crown peak) where a
 * bigger copy of the shape would not stay a similar shape.
 */
export function fillOutlinedPolygon(
  g: Phaser.GameObjects.Graphics,
  points: readonly Pt[],
  fill: number,
  outline: number,
  grow: number,
  directions: number = OUTLINE_DIRECTIONS,
): void {
  g.fillStyle(outline, 1);
  for (let i = 0; i < directions; i++) {
    const a = (TWO_PI * i) / directions;
    const dx = Math.cos(a) * grow;
    const dy = Math.sin(a) * grow;
    fillPolygon(
      g,
      points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    );
  }
  g.fillStyle(fill, 1);
  fillPolygon(g, points);
}

const ELLIPSE_STEPS = 20;

/** A rotated ellipse as points. */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, rad: number): Pt[] {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points: Pt[] = [];
  for (let i = 0; i < ELLIPSE_STEPS; i++) {
    const a = (TWO_PI * i) / ELLIPSE_STEPS;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    points.push({ x: cx + ex * cos - ey * sin, y: cy + ex * sin + ey * cos });
  }
  return points;
}

/** An oval part of a blob, drawn pixels. */
export interface Blob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * A blob drawn as ovals: one outline pass (`outlinePx` wide), one shadow pass and one lit pass
 * over all of them, so the parts melt into one body; the lit tone is each oval `band` smaller, up
 * and to the left, so the shadow shows as a band below and to the right.
 */
export function drawBlobs(
  g: Phaser.GameObjects.Graphics,
  outlinePx: number,
  blobs: readonly Blob[],
  base: number,
  shadow: number,
  outline: number,
  band: number,
): void {
  g.fillStyle(outline, 1);
  for (const b of blobs)
    fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx + outlinePx, b.ry + outlinePx, 0));
  g.fillStyle(shadow, 1);
  for (const b of blobs) fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx, b.ry, 0));
  g.fillStyle(base, 1);
  for (const b of blobs) {
    fillPolygon(
      g,
      ellipsePoints(
        b.cx - b.rx * band,
        b.cy - b.ry * band,
        b.rx * (1 - band),
        b.ry * (1 - band),
        0,
      ),
    );
  }
}

/**
 * A teardrop of `w` x `h`, the tip up: an outline `outlinePx` wide, a body and a light spot
 * (`colors` in that order).
 */
export function drawTeardrop(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  colors: readonly [outline: number, body: number, light: number],
  outlinePx: number,
): void {
  const [outline, shadow, light] = colors;
  const r = w / 2 - outlinePx * 0.6;
  const cy = h - w / 2 - outlinePx * 0.2;
  // A round head and a pointed tip: the arc leaves out the top wedge, the tip closes it.
  const shape = (grow: number, dx: number, dy: number): Pt[] => {
    const points: Pt[] = [];
    for (let deg = -50; deg <= 230; deg += 10) {
      const a = deg * DEG_TO_RAD;
      points.push({
        x: w / 2 + dx + Math.cos(a) * (r + grow),
        y: cy + dy + Math.sin(a) * (r + grow),
      });
    }
    points.push({ x: w / 2 + dx, y: outlinePx * 0.4 + dy - grow * 0.8 });
    return points;
  };
  g.fillStyle(outline, 1);
  fillPolygon(g, shape(outlinePx * 0.6, 0, 0));
  g.fillStyle(shadow, 1);
  fillPolygon(g, shape(0, 0, 0));
  g.fillStyle(light, 1);
  fillPolygon(g, shape(-1.2, -0.9, -0.9));
}

export interface GlossMark {
  /** Centre of the short stroke. */
  x: number;
  y: number;
  length: number;
  thick: number;
  /** Tilt of the stroke, radians. */
  tilt: number;
  /** Gap between the stroke and the dot after it, and the dot radius. */
  dotGap: number;
  dotRadius: number;
  color: number;
  alpha: number;
}

/** The highlight of the glaze: a short white stroke and a dot next to it, no blur. */
export function drawGlossMark(g: Phaser.GameObjects.Graphics, m: GlossMark): void {
  g.fillStyle(m.color, m.alpha);
  fillPolygon(g, ellipsePoints(m.x, m.y, m.length / 2, m.thick / 2, m.tilt));
  const reach = m.length / 2 + m.dotGap;
  g.fillCircle(m.x + Math.cos(m.tilt) * reach, m.y + Math.sin(m.tilt) * reach, m.dotRadius);
}

/** A highlight written as shares of one unit length (a picture size, a radius); tilt in degrees. */
export interface GlossShares {
  x: number;
  y: number;
  length: number;
  thick: number;
  tiltDeg: number;
  dotGap: number;
  dotRadius: number;
}

/**
 * The mark for a highlight given in shares of `unit`, centred on (cx, cy). The offset `x`, `y` is
 * measured in `reach` instead of `unit` when the picture is not square.
 */
export function glossFromShares(
  spec: GlossShares,
  cx: number,
  cy: number,
  unit: number,
  color: number,
  alpha: number,
  reach: Pt = { x: unit, y: unit },
): GlossMark {
  return {
    x: cx + spec.x * reach.x,
    y: cy + spec.y * reach.y,
    length: spec.length * unit,
    thick: spec.thick * unit,
    tilt: spec.tiltDeg * DEG_TO_RAD,
    dotGap: spec.dotGap * unit,
    dotRadius: spec.dotRadius * unit,
    color,
    alpha,
  };
}

const CORNER_STEPS = 6;

/** A rounded rectangle as points; `radius` is cut down to fit the half sizes. */
export function roundRectPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  radius: number,
): Pt[] {
  const r = Math.min(radius, rx, ry);
  const points: Pt[] = [];
  // Corners clockwise from the top left: the arc starts at `from` and sweeps a quarter turn.
  const corners = [
    { x: cx - rx + r, y: cy - ry + r, from: Math.PI },
    { x: cx + rx - r, y: cy - ry + r, from: -Math.PI / 2 },
    { x: cx + rx - r, y: cy + ry - r, from: 0 },
    { x: cx - rx + r, y: cy + ry - r, from: Math.PI / 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= CORNER_STEPS; i++) {
      const a = c.from + (Math.PI / 2) * (i / CORNER_STEPS);
      points.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
  }
  return points;
}

/**
 * A domed shape, a lid: the top corners are quarter ellipses of `topShare` of the half sizes (1 is a half
 * ellipse), the bottom corners are small circles of `bottomShare` of the smaller half size. Same point
 * order as `roundRectPoints`.
 */
export function domeShape(topShare: number, bottomShare: number): BodyShape {
  return (cx, cy, rx, ry) => {
    const ax = rx * topShare;
    const ay = ry * topShare;
    const r = Math.min(rx, ry) * bottomShare;
    const corners = [
      { x: cx - rx + ax, y: cy - ry + ay, rx: ax, ry: ay, from: Math.PI },
      { x: cx + rx - ax, y: cy - ry + ay, rx: ax, ry: ay, from: -Math.PI / 2 },
      { x: cx + rx - r, y: cy + ry - r, rx: r, ry: r, from: 0 },
      { x: cx - rx + r, y: cy + ry - r, rx: r, ry: r, from: Math.PI / 2 },
    ];
    const points: Pt[] = [];
    for (const c of corners) {
      for (let i = 0; i <= CORNER_STEPS; i++) {
        const a = c.from + (Math.PI / 2) * (i / CORNER_STEPS);
        points.push({ x: c.x + Math.cos(a) * c.rx, y: c.y + Math.sin(a) * c.ry });
      }
    }
    return points;
  };
}

/** An outline of a body around (cx, cy) with half sizes `rx`, `ry`. */
export type BodyShape = (cx: number, cy: number, rx: number, ry: number) => Pt[];

export interface TwoToneBody {
  base: number;
  shadow: number;
  /** How far the outline reaches beyond the body, pixels. */
  grow: number;
  /** The lit body is smaller by this share and pushed to the top left: what stays is the flat band. */
  band: number;
}

/**
 * The body of the manner: a thick outline in the dark tone of the fill, the shadow tone, then the
 * lit main tone as a smaller copy pushed to the top left so only a flat band stays at the bottom right.
 */
export function drawTwoToneBody(
  g: Phaser.GameObjects.Graphics,
  shape: BodyShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  look: TwoToneBody,
): void {
  g.fillStyle(outlineColor(look.base), 1);
  fillPolygon(g, shape(cx, cy, rx + look.grow, ry + look.grow));
  g.fillStyle(look.shadow, 1);
  fillPolygon(g, shape(cx, cy, rx, ry));
  g.fillStyle(look.base, 1);
  fillPolygon(
    g,
    shape(cx - rx * look.band, cy - ry * look.band, rx * (1 - look.band), ry * (1 - look.band)),
  );
}

/** Shares of the picture size: where the eyes and the smile sit and how big they are. */
export interface FaceLook {
  eyeY: number;
  eyeSpacing: number;
  eyeRadius: number;
  smileY: number;
  smileRadius: number;
  /** The smile arc covers this many degrees around straight down. */
  smileSpanDeg: number;
  smileThick: number;
}

/** Two dot eyes and a smile around (cx, cy); the shares of `look` are of `size`. */
export function drawFace(
  g: Phaser.GameObjects.Graphics,
  size: number,
  cx: number,
  cy: number,
  look: FaceLook,
  color: number,
): void {
  const half = (size * look.eyeSpacing) / 2;
  g.fillStyle(color, 1);
  g.fillCircle(cx - half, cy + size * look.eyeY, size * look.eyeRadius);
  g.fillCircle(cx + half, cy + size * look.eyeY, size * look.eyeRadius);
  const span = (look.smileSpanDeg * DEG_TO_RAD) / 2;
  const down = Math.PI / 2;
  const radius = size * look.smileRadius;
  g.lineStyle(size * look.smileThick, color, 1);
  g.beginPath();
  g.arc(cx, cy + size * look.smileY - radius, radius, down - span, down + span);
  g.strokePath();
}

export interface BandLook {
  base: number;
  shadow: number;
  /** Outline reach beyond the band, pixels. */
  grow: number;
  /** The shadow strip on the right as a share of the band width. */
  shadowShare: number;
}

/** The smallest y of the outline at `x`: where a vertical line first meets the top of a closed shape. */
export function topEdgeAt(points: readonly Pt[], x: number): number {
  let top = Infinity;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    if (!b || a.x === b.x) return;
    const t = (x - a.x) / (b.x - a.x);
    if (t >= 0 && t <= 1) top = Math.min(top, a.y + (b.y - a.y) * t);
  });
  return top;
}

/** A vertical strip between two x with its own top edge at each side. */
function fillStrip(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  x1: number,
  top0: number,
  top1: number,
  bottom: number,
): void {
  fillPolygon(g, [
    { x: x0, y: top0 },
    { x: x1, y: top1 },
    { x: x1, y: bottom },
    { x: x0, y: bottom },
  ]);
}

/**
 * A vertical band (ribbon, metal strap) down to `bottom`: an outline on both sides, a shadow strip and the lit part.
 * `top` is a y, or a function of x for a band that follows a curved top edge (the silhouette of the body under it).
 */
export function drawVerticalBand(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  top: number | ((x: number) => number),
  bottom: number,
  width: number,
  look: BandLook,
): void {
  const topAt = typeof top === 'number' ? () => top : top;
  // A curved top edge leaves the band's own outline to show along it, so the fill starts one outline lower.
  const inset = typeof top === 'number' ? 0 : look.grow;
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const lit = x1 - width * look.shadowShare;
  g.fillStyle(outlineColor(look.base), 1);
  fillStrip(
    g,
    x0 - look.grow,
    x1 + look.grow,
    topAt(x0 - look.grow),
    topAt(x1 + look.grow),
    bottom,
  );
  g.fillStyle(look.shadow, 1);
  fillStrip(g, x0, x1, topAt(x0) + inset, topAt(x1) + inset, bottom);
  g.fillStyle(look.base, 1);
  fillStrip(g, x0, lit, topAt(x0) + inset, topAt(lit) + inset, bottom);
}

/** A rounded rectangle body whose corner radius is `share` of its smaller half size. */
export const roundShape =
  (share: number): BodyShape =>
  (cx, cy, rx, ry) =>
    roundRectPoints(cx, cy, rx, ry, Math.min(rx, ry) * share);

/**
 * The mouth of an opened box: a ring centred on the top edge `top` of the body, in `ringColor`, with
 * a dark inside. Its back half forms the top silhouette; `grow` is the outline thickness.
 */
export function drawOpeningRing(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  top: number,
  rx: number,
  ry: number,
  innerShare: number,
  ringColor: number,
  insideColor: number,
  grow: number,
): void {
  g.fillStyle(ringColor, 1);
  fillPolygon(g, ellipsePoints(cx, top, rx + grow, ry + grow, 0));
  g.fillStyle(insideColor, 1);
  fillPolygon(
    g,
    ellipsePoints(cx, top + ry * (1 - innerShare), rx * innerShare, ry * innerShare, 0),
  );
}

/** Where an opened body sits inside its picture: room above for the back half of the opening ring. */
export interface OpenBodyLayout {
  texW: number;
  texH: number;
  /** y of the middle of the body rectangle inside the picture. */
  centerY: number;
  /** Image origin that anchors the picture on the middle of the body. */
  origin: { x: number; y: number };
}

/** Picture size, body centre and anchor of a body `width` x `bodyHeight` whose opening ring has half height `ryShare` of the body height. */
export function openBodyLayout(
  width: number,
  bodyHeight: number,
  ryShare: number,
  grow: number,
  pad: number,
): OpenBodyLayout {
  const openReach = Math.ceil(bodyHeight * ryShare + grow);
  const texW = width + pad * 2;
  const texH = bodyHeight + pad * 2 + openReach;
  const centerY = pad + openReach + bodyHeight / 2;
  return { texW, texH, centerY, origin: { x: 0.5, y: centerY / texH } };
}

import type * as Phaser from 'phaser';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { ZONE_RULES } from '../../data/zones';
import { TWO_PI } from '../../util/math';
import { scatter } from '../objects/creature-art/primitives';
import { bakeTexture } from '../ui/bake-texture';
import { outlineColor } from './plain-style';

/**
 * The figures of the cloud bank: the dense cloud of the clouds zone and the see-through nebula of
 * Space. Each is ONE baked picture (a union of circles and one rounded body, so the outline runs
 * round the whole figure and no puff shows inside), not a row of puffs.
 */

const cfg = RULE_ANIM.cloud;
const figure = cfg.figure;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface BodyRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A silhouette: the flat body and the circles that make its wavy edge and its tails. */
export interface Silhouette {
  body: BodyRect;
  circles: readonly Circle[];
}

/** The width (display px) the body must have to hide a layer anywhere on the screen at any moment of the cover. */
export function requiredBodyWidth(): number {
  // The layer can be anywhere on the screen; the figure sways, drifts on while it covers, and breathes.
  const moves = cfg.driftPx + cfg.swayPx + (cfg.driftSpeed * ZONE_RULES.clouds.coverMs[1]) / 1000;
  return (LOGICAL_SIZE.width + 2 * moves) / (1 - cfg.breathe);
}

/** The body of the figure in display px: how wide and how tall it hides the layer row. */
export function bodyDisplaySize(): { width: number; height: number } {
  const b = figure.body;
  return {
    width: (b.right - b.left) * figure.scale,
    height: (b.bottom - b.top) * figure.scale,
  };
}

/** A wavy row of bumps along a horizontal edge: `count` circles from `x0` to `x1`, each of its own size and height. */
function bumps(
  count: number,
  x0: number,
  x1: number,
  edgeY: number,
  dir: 1 | -1,
  radius: readonly [number, number],
  reach: readonly [number, number],
  salt: number,
): Circle[] {
  const out: Circle[] = [];
  for (let i = 0; i < count; i++) {
    const r = radius[0] + (radius[1] - radius[0]) * scatter(i, salt);
    const h = reach[0] + (reach[1] - reach[0]) * scatter(i, salt + 0.37);
    const x = x0 + ((x1 - x0) * i) / (count - 1);
    // The bump's far edge sticks out `h` past the body edge.
    out.push({ x, y: edgeY + dir * (h - r), r });
  }
  return out;
}

/** A tail: `n` circles shrinking along the way (`dx`, `dy` per step), curled by `bend` per step. */
function tail(
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
  n: number,
  bend: number,
): Circle[] {
  const out: Circle[] = [];
  let sx = dx;
  let sy = dy;
  let cx = x;
  let cy = y;
  let cr = r;
  for (let i = 0; i < n; i++) {
    out.push({ x: cx, y: cy, r: cr });
    cx += sx;
    cy += sy;
    const nx = sx * Math.cos(bend) - sy * Math.sin(bend);
    sy = sx * Math.sin(bend) + sy * Math.cos(bend);
    sx = nx;
    cr *= 0.72;
  }
  return out;
}

/** The cloud: gentle waves of mid-size bumps and a flatter belly. */
export function cloudSilhouette(): Silhouette {
  const body = figure.body;
  const mid = (body.top + body.bottom) / 2;
  return {
    body,
    circles: [
      ...bumps(9, 92, 908, body.top, -1, [62, 90], [28, 58], 0.3),
      ...bumps(7, 104, 896, body.bottom, 1, [46, 66], [20, 38], 0.7),
      { x: 112, y: mid, r: (body.bottom - body.top) / 2 + 12 },
      { x: 888, y: mid, r: (body.bottom - body.top) / 2 + 12 },
    ],
  };
}

/** The nebula: a lumpier, more irregular mass with tails and wisps at the edges. */
export function nebulaSilhouette(): Silhouette {
  const body = figure.body;
  return {
    body,
    circles: [
      ...bumps(10, 96, 904, body.top, -1, [46, 100], [14, 78], 0.2),
      ...bumps(8, 110, 890, body.bottom, 1, [40, 84], [12, 62], 0.55),
      // Wisps: little shrinking curls trailing off the lumps at the ends.
      ...tail(120, 118, -26, -24, 30, 4, 0.5),
      ...tail(880, 252, 26, 22, 30, 4, 0.5),
      ...tail(60, 232, -8, 28, 26, 3, -0.45),
      ...tail(940, 128, 8, -28, 26, 3, -0.45),
    ],
  };
}

/** Everything that must lie inside the texture: its extreme points along the outline stroke. */
export function silhouetteBounds(s: Silhouette): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  let left = s.body.left;
  let right = s.body.right;
  let top = s.body.top;
  let bottom = s.body.bottom;
  for (const c of s.circles) {
    left = Math.min(left, c.x - c.r);
    right = Math.max(right, c.x + c.r);
    top = Math.min(top, c.y - c.r);
    bottom = Math.max(bottom, c.y + c.r);
  }
  return { left, right, top, bottom };
}

/** Fills a silhouette grown by `grow` px (shrunk when negative) and moved down by `drop`. */
function fillSilhouette(
  g: Phaser.GameObjects.Graphics,
  s: Silhouette,
  color: number,
  grow: number,
  drop: number,
): void {
  g.fillStyle(color, 1);
  for (const c of s.circles) {
    const r = c.r + grow;
    if (r > 0) g.fillCircle(c.x, c.y + drop, r);
  }
  const b = s.body;
  const w = b.right - b.left + grow * 2;
  const h = b.bottom - b.top + grow * 2;
  if (w <= 0 || h <= 0) return;
  g.fillRoundedRect(b.left - grow, b.top - grow + drop, w, h, Math.min(h / 2, w / 2) * 0.9);
}

/** A curl: a spiral stroke of `turns` turns that opens up to radius `r` around (`cx`, `cy`). */
function strokeCurl(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  turns: number,
  start: number,
  width: number,
  color: number,
): void {
  const steps = Math.ceil(turns * 24);
  g.lineStyle(width, color, 1);
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const a = start + k * turns * TWO_PI;
    const rr = r * (0.15 + 0.85 * k);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.8;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
}

/** Which texture keys hold the figures (the baker is called from `createTreasureTextures`). */
export function bakeCloudFigure(scene: Phaser.Scene, key: string): void {
  const c = cfg.colors;
  const s = cloudSilhouette();
  const edge = outlineColor(c.lilac);
  bakeTexture(scene, key, figure.width, figure.height, (g) => {
    fillSilhouette(g, s, edge, figure.outline, 0);
    // Two tones: the lilac belly under everything, a pink rim light on top, the white body between.
    fillSilhouette(g, s, c.lilac, 0, 0);
    fillSilhouette(g, s, c.pink, -14, -14);
    fillSilhouette(g, s, c.white, -25, -3);
    strokeCurl(g, 330, 185, 40, 1.35, 0.4, 8, c.curl);
    strokeCurl(g, 690, 175, 34, 1.35, 3.4, 8, c.curl);
  });
}

/** The nebula: pink body with a lighter top, blue and light-pink blotches, white curls. */
export function bakeNebulaFigure(scene: Phaser.Scene, key: string): void {
  const n = cfg.nebula.colors;
  const s = nebulaSilhouette();
  const edge = outlineColor(n.pink);
  const blotches: ReadonlyArray<{ x: number; y: number; r: number; blue: boolean }> = [
    { x: 150, y: 150, r: 18, blue: true },
    { x: 280, y: 142, r: 16, blue: false },
    { x: 400, y: 160, r: 20, blue: true },
    { x: 520, y: 140, r: 15, blue: false },
    { x: 640, y: 158, r: 19, blue: true },
    { x: 770, y: 144, r: 16, blue: false },
    { x: 870, y: 160, r: 17, blue: true },
    { x: 450, y: 232, r: 14, blue: false },
    { x: 810, y: 232, r: 13, blue: true },
  ];
  bakeTexture(scene, key, figure.width, figure.height, (g) => {
    fillSilhouette(g, s, edge, figure.outline, 0);
    fillSilhouette(g, s, n.pink, 0, 0);
    fillSilhouette(g, s, n.pinkLight, -16, -16);
    for (const b of blotches) {
      // A blotch is a little cluster of three overlapping circles, so it reads as a soft lump.
      g.fillStyle(b.blue ? n.blue : n.blotch, 1);
      g.fillCircle(b.x, b.y, b.r);
      g.fillCircle(b.x + b.r * 0.9, b.y + b.r * 0.25, b.r * 0.7);
      g.fillCircle(b.x - b.r * 0.8, b.y + b.r * 0.35, b.r * 0.6);
    }
    strokeCurl(g, 220, 205, 40, 1.4, 0.2, 8, n.curl);
    strokeCurl(g, 560, 215, 36, 1.4, 2.8, 8, n.curl);
    strokeCurl(g, 700, 200, 38, 1.4, 4.4, 8, n.curl);
    strokeCurl(g, 340, 215, 28, 1.3, 1.2, 7, n.curl);
  });
}

import type * as Phaser from 'phaser';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { ZONE_RULES } from '../../data/zones';
import { TWO_PI } from '../../util/math';
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
  /** The top line: domes that every tone pass follows. */
  circles: readonly Circle[];
  /** Lobes and wisps that hang below or stick out: only the outline and the base tone take them, so the shade stays one flat band. */
  lobes: readonly Circle[];
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

/** The cloud: a cumulus mass, two big domes with the tallest hump right of the middle, smaller bumps between, an uneven belly. */
export function cloudSilhouette(): Silhouette {
  return {
    body: figure.body,
    circles: [
      // Domes of the top line, from the low left end to the tall hump and down to the right.
      { x: 150, y: 150, r: 55 },
      { x: 232, y: 140, r: 64 },
      { x: 330, y: 128, r: 98 },
      { x: 450, y: 150, r: 66 },
      { x: 560, y: 120, r: 82 },
      { x: 640, y: 116, r: 100 },
      { x: 760, y: 140, r: 70 },
      { x: 860, y: 150, r: 52 },
      { x: 925, y: 170, r: 38 },
    ],
    lobes: [
      // An uneven belly: a few flatter lobes of different depth, one hanging lower.
      { x: 205, y: 240, r: 38 },
      { x: 390, y: 244, r: 30 },
      { x: 560, y: 252, r: 52 },
      { x: 700, y: 242, r: 34 },
      { x: 850, y: 244, r: 26 },
    ],
  };
}

/**
 * The nebula: a swollen middle with a lobe hanging down, thinning out towards both ends, with
 * wisps trailing off the thin parts (the ends of the body are the row that always covers the layer).
 */
export function nebulaSilhouette(): Silhouette {
  return {
    body: figure.body,
    circles: [
      { x: 140, y: 150, r: 40 },
      { x: 235, y: 142, r: 52 },
      { x: 345, y: 116, r: 70 },
      { x: 438, y: 62, r: 46 },
      { x: 505, y: 112, r: 100 },
      { x: 640, y: 126, r: 82 },
      { x: 745, y: 138, r: 56 },
      { x: 840, y: 150, r: 38 },
      { x: 905, y: 168, r: 30 },
    ],
    lobes: [
      // Underside: a lobe hanging low in the middle and smaller ones beside it.
      { x: 520, y: 268, r: 72 },
      { x: 395, y: 250, r: 46 },
      { x: 665, y: 250, r: 40 },
      { x: 300, y: 240, r: 28 },
      { x: 790, y: 244, r: 24 },
      { x: 190, y: 238, r: 20 },
      // Wisps: small shrinking curls trailing off the thin parts, inside the visible screen.
      ...tail(215, 232, -22, 20, 24, 4, 0.45),
      ...tail(790, 118, 20, -22, 24, 4, -0.5),
      ...tail(120, 175, -22, -4, 24, 3, 0.4),
      ...tail(880, 188, 20, 8, 22, 3, -0.4),
    ],
  };
}

/** Where the top edge of a silhouette is at column `x` (the smallest y covered), for checking its profile. */
export function silhouetteTopAt(s: Silhouette, x: number): number {
  let top = x >= s.body.left && x <= s.body.right ? s.body.top : Infinity;
  for (const c of [...s.circles, ...s.lobes]) {
    const dx = Math.abs(x - c.x);
    if (dx < c.r) top = Math.min(top, c.y - Math.sqrt(c.r * c.r - dx * dx));
  }
  return top;
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
  for (const c of [...s.circles, ...s.lobes]) {
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
  // The lobes belong to the outline and the base tone only (`grow >= 0`).
  for (const c of grow >= 0 ? [...s.circles, ...s.lobes] : s.circles) {
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
    strokeCurl(g, 330, 150, 42, 1.35, 0.4, 8, c.curl);
    strokeCurl(g, 640, 160, 46, 1.35, 3.4, 8, c.curl);
  });
}

/** The nebula: pink body with a lighter top, blue and light-pink blotches, white curls. */
export function bakeNebulaFigure(scene: Phaser.Scene, key: string): void {
  const n = cfg.nebula.colors;
  const s = nebulaSilhouette();
  const edge = outlineColor(n.pink);
  const blotches: ReadonlyArray<{ x: number; y: number; r: number; blue: boolean }> = [
    { x: 380, y: 100, r: 22, blue: true },
    { x: 520, y: 70, r: 26, blue: true },
    { x: 650, y: 100, r: 19, blue: true },
    { x: 300, y: 150, r: 14, blue: true },
    { x: 800, y: 160, r: 11, blue: true },
    { x: 440, y: 135, r: 17, blue: false },
    { x: 575, y: 140, r: 21, blue: false },
    { x: 705, y: 165, r: 14, blue: false },
    { x: 230, y: 155, r: 12, blue: false },
    { x: 520, y: 225, r: 20, blue: false },
    { x: 400, y: 235, r: 12, blue: true },
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
    strokeCurl(g, 430, 165, 36, 1.4, 0.2, 8, n.curl);
    strokeCurl(g, 600, 175, 42, 1.4, 2.8, 8, n.curl);
    strokeCurl(g, 530, 240, 30, 1.4, 4.4, 8, n.curl);
    strokeCurl(g, 760, 175, 26, 1.3, 1.2, 7, n.curl);
  });
}

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
 * The nebula: a swollen middle thinning out towards both ends. Its top stays low above the body
 * (`nebulaTopMin`) so that on a short screen it does not reach the HUD plates over the row, and
 * its underside is ONE smooth wave (a close row of circles along `nebulaBelly`), no small lumps.
 */
export function nebulaSilhouette(): Silhouette {
  const belly = cfg.nebula.belly;
  const lobes: Circle[] = [];
  for (let x = belly.from; x <= belly.to; x += belly.step) {
    const k = (x - belly.centre) / belly.spread;
    const bottom = figure.body.bottom - belly.base + (belly.depth + belly.base) * Math.exp(-k * k);
    lobes.push({ x, y: bottom - belly.r, r: belly.r });
  }
  return {
    body: figure.body,
    circles: [
      { x: 140, y: 150, r: 40 },
      { x: 235, y: 142, r: 52 },
      { x: 345, y: 138, r: 54 },
      { x: 505, y: 158, r: 84 },
      { x: 640, y: 148, r: 70 },
      { x: 745, y: 150, r: 48 },
      { x: 840, y: 150, r: 38 },
      { x: 905, y: 168, r: 30 },
    ],
    lobes,
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

/** The nebula: pink body with a lighter top, a few soft lilac-blue smears without an outline, white curls. */
export function bakeNebulaFigure(scene: Phaser.Scene, key: string): void {
  const n = cfg.nebula.colors;
  const s = nebulaSilhouette();
  const edge = outlineColor(n.pink);
  bakeTexture(scene, key, figure.width, figure.height, (g) => {
    fillSilhouette(g, s, edge, figure.outline, 0);
    fillSilhouette(g, s, n.pink, 0, 0);
    fillSilhouette(g, s, n.pinkLight, -16, -16);
    // A smear: two flat overlapping ellipses of one tone, so it reads as a soft stain, not a shape.
    g.fillStyle(n.smear, 1);
    for (const m of cfg.nebula.smears) {
      g.fillEllipse(m.x, m.y, m.w, m.h);
      g.fillEllipse(m.x + m.w * 0.32, m.y + m.h * 0.22, m.w * 0.7, m.h * 0.8);
    }
    strokeCurl(g, 430, 165, 36, 1.4, 0.2, 8, n.curl);
    strokeCurl(g, 600, 175, 42, 1.4, 2.8, 8, n.curl);
    strokeCurl(g, 760, 175, 26, 1.3, 1.2, 7, n.curl);
  });
}

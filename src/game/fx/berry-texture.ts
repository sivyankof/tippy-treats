import type * as Phaser from 'phaser';
import { BERRY_LOOK } from '../../data/berry-look';
import { DEG_TO_RAD, TWO_PI } from '../../util/math';
import { mixColor } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';

const { colors, body, gradient, gloss, seeds, calyx, glow } = BERRY_LOOK;

interface Pt {
  x: number;
  y: number;
}

/** Half width of the body at `u` (0 top .. 1 bottom), as a share of the full half width. */
function bodyHalfWidth(u: number): number {
  return Math.pow(Math.sin(Math.PI * Math.pow(u, body.profileLift)), body.profileRound);
}

/** Fills a closed outline of points with one path. */
function fillPolygon(g: Phaser.GameObjects.Graphics, points: readonly Pt[]): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of rest) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
}

/** The strawberry outline around (cx, cy) with half sizes `rx`, `ry`. */
function bodyOutline(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const points: Pt[] = [];
  const steps = body.outlineSteps;
  // Down the right side, then back up the left.
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    points.push({ x: cx + rx * bodyHalfWidth(u), y: cy - ry + 2 * ry * u });
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    points.push({ x: cx - rx * bodyHalfWidth(u), y: cy - ry + 2 * ry * u });
  }
  return points;
}

/** A rotated ellipse as points. */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number, rad: number): Pt[] {
  const points: Pt[] = [];
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const a = (TWO_PI * i) / steps;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    points.push({ x: cx + ex * cos - ey * sin, y: cy + ex * sin + ey * cos });
  }
  return points;
}

/** One pointed leaf from `from` out along `rad` for `length`, `width` wide in the middle. */
function leafPoints(from: Pt, rad: number, length: number, width: number): Pt[] {
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const nx = -dy;
  const ny = dx;
  const at = (along: number, side: number): Pt => ({
    x: from.x + dx * along + nx * side,
    y: from.y + dy * along + ny * side,
  });
  return [
    at(0, 0),
    at(length * 0.35, -width),
    at(length * 0.8, -width * 0.55),
    at(length, 0),
    at(length * 0.8, width * 0.55),
    at(length * 0.35, width),
  ];
}

function drawGlow(g: Phaser.GameObjects.Graphics, size: number, cx: number): void {
  const cy = size * glow.centerY;
  const inner = size * body.halfWidth;
  const outer = (size / 2) * glow.reach;
  for (let i = 0; i < glow.steps; i++) {
    const t = i / (glow.steps - 1);
    g.fillStyle(colors.glow, glow.alpha);
    g.fillCircle(cx, cy, outer - (outer - inner) * t);
  }
}

function drawBody(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const rx = size * body.halfWidth;
  const ry = size * body.halfHeight;
  const grow = size * body.rimGrow;
  g.fillStyle(colors.rim, 1);
  fillPolygon(g, bodyOutline(cx, cy + grow * 0.4, rx + grow, ry + grow));
  const n = gradient.layers;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const t = Math.pow(f, gradient.curve);
    const color =
      t < 0.5
        ? mixColor(colors.deep, colors.base, t * 2)
        : mixColor(colors.base, colors.light, (t - 0.5) * 2);
    g.fillStyle(color, 1);
    fillPolygon(
      g,
      bodyOutline(
        cx - rx * gradient.shiftX * f,
        cy - ry * gradient.shiftY * f,
        rx * (1 - gradient.shrinkX * f),
        ry * (1 - gradient.shrinkY * f),
      ),
    );
  }
}

function drawGloss(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const rx = size * body.halfWidth;
  const ry = size * body.halfHeight;
  const tilt = gloss.tiltDeg * DEG_TO_RAD;
  for (const patch of [gloss.soft, gloss.bright]) {
    g.fillStyle(colors.gloss, patch.alpha);
    fillPolygon(
      g,
      ellipsePoints(cx + patch.x * rx, cy + patch.y * ry, patch.rx * rx, patch.ry * ry, tilt),
    );
  }
  g.fillStyle(colors.gloss, gloss.dot.alpha);
  g.fillCircle(cx + gloss.dot.x * rx, cy + gloss.dot.y * ry, gloss.dot.r * size);
  // A thin lit rim on the lower right, where light bounces back.
  g.lineStyle(size * 0.014, colors.light, gloss.rimAlpha);
  g.beginPath();
  g.arc(cx, cy + ry * 0.05, rx * 0.88, 20 * DEG_TO_RAD, 70 * DEG_TO_RAD);
  g.strokePath();
}

function drawSeeds(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const rx = size * body.halfWidth;
  const ry = size * body.halfHeight;
  const bright = gloss.bright;
  for (const row of seeds.rows) {
    const half = bodyHalfWidth(row.at) * rx * seeds.spread;
    const y = cy - ry + 2 * ry * row.at;
    for (let k = 0; k < row.count; k++) {
      const share = row.count < 2 ? 0 : (2 * k) / (row.count - 1) - 1;
      const x = cx + share * half;
      if (Math.hypot((x - cx) / rx - bright.x, (y - cy) / ry - bright.y) < seeds.glossClearance) {
        continue;
      }
      // Seeds on the sides lean outward: they sit on a round body.
      const tilt = share * 0.35;
      g.fillStyle(colors.seedShadow, seeds.shadowAlpha);
      fillPolygon(
        g,
        ellipsePoints(x, y + size * seeds.shadowDrop, size * seeds.rx, size * seeds.ry, tilt),
      );
      g.fillStyle(colors.seed, 1);
      fillPolygon(g, ellipsePoints(x, y, size * seeds.rx, size * seeds.ry, tilt));
    }
  }
}

function drawCalyx(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const ry = size * body.halfHeight;
  const hub: Pt = { x: cx, y: cy - ry + 2 * ry * calyx.sinkShare };
  const stemW = size * calyx.stemWidth;
  const stemH = size * calyx.stemHeight;
  const leaves = calyx.leaves;
  // Back to front: the leaves that stand up go first, the ones draped on the body after.
  const order = [...leaves].sort((a, b) => Math.abs(a.deg) - Math.abs(b.deg));
  for (const pass of [colors.leafDark, colors.leaf] as const) {
    for (const leaf of order) {
      const rad = leaf.deg * DEG_TO_RAD;
      const grow = pass === colors.leafDark ? size * calyx.outline : 0;
      g.fillStyle(pass, 1);
      fillPolygon(
        g,
        leafPoints(hub, rad, size * leaf.length + grow, size * calyx.leafWidth + grow),
      );
    }
  }
  // A lighter strip down the middle of each leaf.
  g.fillStyle(colors.leafLight, 0.55);
  for (const leaf of order) {
    const rad = leaf.deg * DEG_TO_RAD;
    fillPolygon(g, leafPoints(hub, rad, size * leaf.length * 0.7, size * calyx.leafWidth * 0.28));
  }
  g.fillStyle(colors.stem, 1);
  g.fillRoundedRect(hub.x - stemW / 2, hub.y - stemH, stemW, stemH + stemW * 0.4, stemW * 0.45);
  g.fillStyle(colors.leafLight, 0.6);
  g.fillRoundedRect(hub.x - stemW * 0.28, hub.y - stemH * 0.92, stemW * 0.26, stemH * 0.7, 2);
}

/**
 * Bakes the berry: a glossy strawberry with a light top and a deep bottom, seeds, a green calyx
 * and a soft glow. Not meant for tinting.
 */
export function bakeBerry(scene: Phaser.Scene, key: string): void {
  const size = BERRY_LOOK.textureSize;
  const cx = size / 2;
  const cy = size * body.centerY;
  bakeTexture(scene, key, size, size, (g) => {
    drawGlow(g, size, cx);
    drawBody(g, size, cx, cy);
    drawSeeds(g, size, cx, cy);
    drawGloss(g, size, cx, cy);
    drawCalyx(g, size, cx, cy);
  });
}

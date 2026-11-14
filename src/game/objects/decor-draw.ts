import type * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { PLAIN_LAYER, type DecorKind } from '../../data/plain-layers';
import { shade } from '../../util/color';
import { TWO_PI } from '../../util/math';
import type { DecorItem } from './decor-layout';

const D = PLAIN_LAYER.decor;
/** Every decoration has a thin darker rim of its own colour. */
const RIM_SHADE = -0.28;
const RIM_PX = 1.2;
/** Points of a turned oval. */
const OVAL_POINTS = 14;
/** A strawberry is a little taller than wide; its seeds and leaf, relative to its radius. */
const STRAWBERRY_STRETCH = 1.12;
const SEED_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [-0.35, 0.05],
  [0.3, -0.1],
  [0.05, 0.42],
];
const SEED_R = 0.12;
const LEAF_W = 0.9;
const LEAF_H = 0.38;
/** A blueberry is smaller than a strawberry; its light bloom and its dark crown. */
const BLUEBERRY_SCALE = 0.85;
const BLOOM_R = 0.35;
const BLOOM_SHIFT = -0.3;
const CROWN_R = 0.18;
/** Half the berries are strawberries, the rest blueberries. */
const STRAWBERRY_SHARE = 0.5;
/** Flower centre, relative to a petal. */
const FLOWER_CENTER = 0.75;
/** Chopped nuts come in sizes from `NUT_SIZE_MIN` to that plus `NUT_SIZE_SPAN` of the data size. */
const NUT_SIZE_MIN = 0.8;
const NUT_SIZE_SPAN = 0.4;
/** Highlight on a nut, relative to its size. */
const NUT_SHINE = 0.3;
/** Whipped cream: three swirls going up and narrowing, and a soft shadow under it. */
const CREAM_SWIRLS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [-0.62, 0.72],
  [-1.12, 0.44],
];
const CREAM_TIP = { dy: -1.42, r: 0.2 } as const;
const CREAM_SHADOW = { dy: 0.55, w: 2.3, h: 0.7 } as const;

/** A filled oval of radii `rx`, `ry`, turned by `angle` (radians). */
function fillOval(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  g.beginPath();
  for (let i = 0; i < OVAL_POINTS; i++) {
    const a = (TWO_PI * i) / OVAL_POINTS;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    const vx = x + px * cos - py * sin;
    const vy = y + px * sin + py * cos;
    if (i === 0) g.moveTo(vx, vy);
    else g.lineTo(vx, vy);
  }
  g.closePath();
  g.fillPath();
}

function drawSprinkle(g: Phaser.GameObjects.Graphics, item: DecorItem): void {
  const { length, width, colors } = D.sprinkles;
  const color = colors[Math.floor(item.variant * colors.length) % colors.length]!;
  const dx = (Math.cos(item.angle) * length) / 2;
  const dy = (Math.sin(item.angle) * length) / 2;
  g.lineStyle(width, color, 1);
  g.lineBetween(item.x - dx, item.y - dy, item.x + dx, item.y + dy);
  g.fillStyle(color, 1);
  g.fillCircle(item.x - dx, item.y - dy, width / 2);
  g.fillCircle(item.x + dx, item.y + dy, width / 2);
}

function drawBerry(g: Phaser.GameObjects.Graphics, item: DecorItem): void {
  const b = D.berries;
  const { x, y } = item;
  if (item.variant < STRAWBERRY_SHARE) {
    const r = b.radius;
    g.fillStyle(b.leaf, 1);
    fillOval(g, x, y - r * STRAWBERRY_STRETCH, r * LEAF_W, r * LEAF_H, 0);
    g.fillStyle(shade(b.strawberry, RIM_SHADE), 1);
    fillOval(g, x, y, r + RIM_PX, r * STRAWBERRY_STRETCH + RIM_PX, 0);
    g.fillStyle(b.strawberry, 1);
    fillOval(g, x, y, r, r * STRAWBERRY_STRETCH, 0);
    g.fillStyle(b.seed, 1);
    for (const [sx, sy] of SEED_SPOTS) g.fillCircle(x + sx * r, y + sy * r, r * SEED_R);
    return;
  }
  const r = b.radius * BLUEBERRY_SCALE;
  g.fillStyle(shade(b.blueberry, RIM_SHADE), 1);
  g.fillCircle(x, y, r + RIM_PX);
  g.fillStyle(b.blueberry, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(b.bloom, 1);
  g.fillCircle(x + r * BLOOM_SHIFT, y + r * BLOOM_SHIFT, r * BLOOM_R);
  g.fillStyle(shade(b.blueberry, RIM_SHADE), 1);
  g.fillCircle(x, y - r * (1 - CROWN_R), r * CROWN_R);
}

function drawFlower(g: Phaser.GameObjects.Graphics, item: DecorItem): void {
  const f = D.flowers;
  for (const [color, grow] of [
    [shade(f.color, RIM_SHADE / 2), RIM_PX],
    [f.color, 0],
  ] as const) {
    g.fillStyle(color, 1);
    for (let i = 0; i < f.petals; i++) {
      const a = item.angle + (TWO_PI * i) / f.petals;
      g.fillCircle(
        item.x + Math.cos(a) * f.spread,
        item.y + Math.sin(a) * f.spread,
        f.petal + grow,
      );
    }
  }
  g.fillStyle(f.center, 1);
  g.fillCircle(item.x, item.y, f.petal * FLOWER_CENTER);
}

function drawNut(g: Phaser.GameObjects.Graphics, item: DecorItem): void {
  const n = D.nuts;
  const size = NUT_SIZE_MIN + NUT_SIZE_SPAN * item.variant;
  const rx = (n.width / 2) * size;
  const ry = (n.height / 2) * size;
  g.fillStyle(n.dark, 1);
  fillOval(g, item.x, item.y, rx + RIM_PX, ry + RIM_PX, item.angle);
  g.fillStyle(n.color, 1);
  fillOval(g, item.x, item.y, rx, ry, item.angle);
  g.fillStyle(PALETTE.textLight, NUT_SHINE);
  g.fillCircle(item.x - rx * NUT_SHINE, item.y - ry * NUT_SHINE, ry * NUT_SHINE * 2);
}

function drawCream(g: Phaser.GameObjects.Graphics, item: DecorItem): void {
  const c = D.cream;
  const r = c.radius;
  g.fillStyle(c.shadow, 1);
  g.fillEllipse(item.x, item.y + r * CREAM_SHADOW.dy, r * CREAM_SHADOW.w, r * CREAM_SHADOW.h);
  for (const [color, grow] of [
    [c.shadow, RIM_PX],
    [c.color, 0],
  ] as const) {
    g.fillStyle(color, 1);
    for (const [dy, scale] of CREAM_SWIRLS) g.fillCircle(item.x, item.y + dy * r, r * scale + grow);
    g.fillCircle(item.x, item.y + CREAM_TIP.dy * r, r * CREAM_TIP.r + grow);
  }
}

const DRAWERS: Readonly<
  Record<DecorKind, (g: Phaser.GameObjects.Graphics, item: DecorItem) => void>
> = {
  sprinkles: drawSprinkle,
  berries: drawBerry,
  flowers: drawFlower,
  nuts: drawNut,
  cream: drawCream,
};

/** Colours of the bits that fly off a decoration of this kind. */
export function decorTints(kind: DecorKind): number[] {
  switch (kind) {
    case 'sprinkles':
      return [...D.sprinkles.colors];
    case 'berries':
      return [D.berries.strawberry, D.berries.blueberry];
    case 'flowers':
      return [D.flowers.color, D.flowers.center];
    case 'nuts':
      return [D.nuts.color, D.nuts.dark];
    case 'cream':
      return [D.cream.color];
  }
}

/** Draws the decorations of one kind. */
export function drawDecor(
  g: Phaser.GameObjects.Graphics,
  kind: DecorKind,
  items: readonly DecorItem[],
): void {
  const draw = DRAWERS[kind];
  for (const item of items) draw(g, item);
}

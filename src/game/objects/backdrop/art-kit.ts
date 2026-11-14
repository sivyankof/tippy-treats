import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import type { Point } from '../../../data/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';

type Graphics = Phaser.GameObjects.Graphics;

const PUFF_SIZE = 96;
const PUFF_LAYERS = 10;
const STAR_SIZE = 64;
const STAR_OUTER = 30;
const STAR_INNER = 7;
const STAR_POINTS = 4;

/** Calls `draw` for every copy of a shape that touches a square tile, so the tile repeats without seams. */
export function tiled(
  size: number,
  x: number,
  y: number,
  extent: number,
  draw: (x: number, y: number) => void,
): void {
  for (const dy of [-size, 0, size]) {
    for (const dx of [-size, 0, size]) {
      const px = x + dx;
      const py = y + dy;
      if (px + extent > 0 && px - extent < size && py + extent > 0 && py - extent < size) {
        draw(px, py);
      }
    }
  }
}

/** A soft round glow: stacked translucent discs, brightest in the middle. */
export function glow(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha / PUFF_LAYERS);
  for (let i = 0; i < PUFF_LAYERS; i++) {
    g.fillCircle(x, y, radius * (1 - i / PUFF_LAYERS));
  }
}

/** A four-pointed sparkle centred on (`cx`, `cy`), `radius` to the tips. */
export function sparkle(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  alpha = 1,
): void {
  const steps = STAR_POINTS * 2;
  const at = (i: number): Point => {
    const angle = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius * (STAR_INNER / STAR_OUTER);
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  g.fillStyle(color, alpha);
  for (let i = 0; i < steps; i++) {
    const a = at(i);
    const b = at(i + 1);
    g.fillTriangle(cx, cy, a.x, a.y, b.x, b.y);
  }
}

/** A cartoon cloud: a flat bottom and a few round humps. */
export function cloudShape(
  g: Graphics,
  x: number,
  y: number,
  scale: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.fillCircle(x - 54 * scale, y + 8 * scale, 30 * scale);
  g.fillCircle(x - 18 * scale, y - 14 * scale, 40 * scale);
  g.fillCircle(x + 28 * scale, y - 6 * scale, 34 * scale);
  g.fillCircle(x + 60 * scale, y + 12 * scale, 26 * scale);
  g.fillRoundedRect(x - 84 * scale, y + 6 * scale, 170 * scale, 34 * scale, 17 * scale);
}

/** Cheap source of scattered positions for baked decoration; pictures are cosmetic and baked once. */
export function scatterPoints(
  count: number,
  size: number,
  random: () => number = Math.random,
): Point[] {
  return Array.from({ length: count }, () => ({ x: random() * size, y: random() * size }));
}

/** Soft puff and sparkle: small white pictures that other things tint. */
export function bakeSharedArt(scene: Phaser.Scene): void {
  bakeTexture(scene, BD_TEX.puff, PUFF_SIZE, PUFF_SIZE, (g) => {
    glow(g, PUFF_SIZE / 2, PUFF_SIZE / 2, PUFF_SIZE / 2, BACKDROP_COLORS.shared.white, 1.1);
  });
  bakeTexture(scene, BD_TEX.star, STAR_SIZE, STAR_SIZE, (g) => {
    glow(g, STAR_SIZE / 2, STAR_SIZE / 2, STAR_SIZE / 4, BACKDROP_COLORS.shared.white, 0.5);
    sparkle(g, STAR_SIZE / 2, STAR_SIZE / 2, STAR_SIZE / 2, BACKDROP_COLORS.shared.white);
  });
}

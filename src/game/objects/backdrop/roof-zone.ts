import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';
import { tiled } from './art-kit';
import { Hover, PuffColumn, Traveler } from './life';
import type { ZoneArt } from './zone-scenery';

type Graphics = Phaser.GameObjects.Graphics;

const TILE = 512;
const R = BD_TEX.roof;
const C = BACKDROP_COLORS.roof;
const WHITE = BACKDROP_COLORS.shared.white;
const ROOF_RISE = 0.4;

/** A house with a pitched roof; (`x`, `y`) is the top of the roof. */
function house(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: number,
  roof: number,
): void {
  const rise = w * ROOF_RISE;
  g.fillStyle(wall, 1);
  g.fillRoundedRect(x, y + rise, w, h, 8);
  g.fillStyle(roof, 1);
  g.fillTriangle(x - 10, y + rise, x + w + 10, y + rise, x + w / 2, y);
}

function bakeLayers(scene: Phaser.Scene): void {
  bakeTexture(scene, R.far, TILE, TILE, (g) => {
    const houses = [
      { x: 20, y: 90, w: 120, h: 130 },
      { x: 190, y: 250, w: 100, h: 110 },
      { x: 330, y: 40, w: 130, h: 150 },
      { x: 90, y: 360, w: 110, h: 100 },
      { x: 360, y: 330, w: 100, h: 120 },
    ];
    for (const b of houses) {
      tiled(TILE, b.x, b.y, b.w + b.h, (x, y) => house(g, x, y, b.w, b.h, C.far, C.far));
    }
  });

  bakeTexture(scene, R.mid, TILE, TILE, (g) => {
    const houses = [
      { x: 40, y: 40, w: 170, h: 150 },
      { x: 270, y: 200, w: 190, h: 170 },
      { x: 60, y: 340, w: 150, h: 120 },
    ];
    for (const b of houses) {
      tiled(TILE, b.x, b.y, b.w + b.h, (x, y) => {
        house(g, x, y, b.w, b.h, C.mid, C.midDark);
        g.fillStyle(BACKDROP_COLORS.shared.warmWhite, 0.85);
        const top = y + b.w * ROOF_RISE + 28;
        g.fillRoundedRect(x + 24, top, 36, 44, 8);
        g.fillRoundedRect(x + b.w - 60, top, 36, 44, 8);
      });
    }
  });

  bakeTexture(scene, R.near, TILE, TILE, (g) => {
    g.fillStyle(C.nearDark, 1);
    g.fillRect(0, 456, TILE, 56);
    g.fillStyle(C.near, 1);
    for (let x = 0; x < TILE; x += 40) g.fillCircle(x + 20, 456, 22);
    g.lineStyle(5, C.nearDark, 1);
    for (const x of [120, 360]) {
      g.lineBetween(x, 340, x, 456);
      g.lineBetween(x - 22, 360, x + 22, 360);
      g.lineBetween(x - 14, 380, x + 14, 380);
    }
  });

  bakeTexture(scene, R.pipes, TILE, TILE, (g) => {
    for (const { x, w } of [
      { x: 80, w: 22 },
      { x: 390, w: 16 },
    ]) {
      g.fillStyle(C.nearDark, 1);
      g.fillRect(x, 0, w, TILE);
      g.fillStyle(C.near, 1);
      g.fillRect(x + 3, 0, w / 3, TILE);
      g.fillStyle(C.nearDark, 1);
      for (const y of [90, 300]) g.fillRoundedRect(x - 5, y, w + 10, 16, 5);
    }
  });
}

function bakeLife(scene: Phaser.Scene): void {
  bakeTexture(scene, R.bird, 60, 30, (g) => {
    g.fillStyle(C.bird, 1);
    g.fillTriangle(2, 4, 30, 22, 14, 24);
    g.fillTriangle(58, 4, 30, 22, 46, 24);
    g.fillEllipse(30, 22, 16, 11);
    g.fillCircle(38, 18, 4);
  });
  bakeTexture(scene, R.chimney, 90, 200, (g) => {
    g.fillStyle(C.brick, 1);
    g.fillRoundedRect(15, 36, 60, 164, 4);
    g.fillStyle(C.brickDark, 0.55);
    for (let y = 56; y < 200; y += 22) g.fillRect(15, y, 60, 3);
    g.fillStyle(C.chimneyCap, 1);
    g.fillRoundedRect(5, 16, 80, 26, 6);
  });
  bakeTexture(scene, R.rope, 320, 40, (g) => {
    g.fillStyle(C.pole, 1);
    g.fillRoundedRect(0, 0, 12, 40, 3);
    g.fillRoundedRect(308, 0, 12, 40, 3);
    g.lineStyle(3, C.rope, 1);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const sag = (t: number): number => 10 + 10 * Math.sin(Math.PI * t);
      g.lineBetween(
        12 + (296 * i) / steps,
        sag(i / steps),
        12 + (296 * (i + 1)) / steps,
        sag((i + 1) / steps),
      );
    }
  });
  bakeCloths(scene);
}

/** The washing is baked white and tinted per item; each hangs from its top edge. */
function bakeCloths(scene: Phaser.Scene): void {
  bakeTexture(scene, R.shirt, 70, 80, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(14, 12, 42, 62, 8);
    g.fillRoundedRect(2, 12, 18, 28, 7);
    g.fillRoundedRect(50, 12, 18, 28, 7);
    g.fillStyle(C.pole, 1);
    g.fillRoundedRect(31, 0, 8, 16, 3);
  });
  bakeTexture(scene, R.sock, 36, 64, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(6, 10, 24, 40, 8);
    g.fillEllipse(22, 52, 28, 20);
    g.fillStyle(C.pole, 1);
    g.fillRoundedRect(14, 0, 8, 14, 3);
  });
  bakeTexture(scene, R.sheet, 100, 84, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(4, 10, 92, 68, 12);
    g.fillStyle(C.pole, 1);
    g.fillRoundedRect(14, 0, 8, 14, 3);
    g.fillRoundedRect(78, 0, 8, 14, 3);
  });
}

/** Rooftops: skyline and roofs with birds, chimney smoke and washing in the wind. */
export const roofArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakeLife(scene);
  },
  build(scene) {
    const life = BACKDROP_LIFE.roof;
    return {
      layers: [R.far, R.mid, R.near, R.pipes],
      lives: [
        { slot: 1, life: new Hover(scene, [life.chimney]) },
        { slot: 1, life: new PuffColumn(scene, life.smoke, life.smokeAt, life.smokeOffset) },
        { slot: 2, life: new Hover(scene, [life.rope, ...life.laundry]) },
        { slot: 2, life: new Traveler(scene, life.birds) },
      ],
    };
  },
};

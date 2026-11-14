import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';
import { glow, scatterPoints, sparkle, tiled } from './art-kit';
import { Hover, Traveler } from './life';
import type { ZoneArt } from './zone-scenery';

type Graphics = Phaser.GameObjects.Graphics;

const TILE = 512;
const P = BD_TEX.space;
const C = BACKDROP_COLORS.space;
const WHITE = BACKDROP_COLORS.shared.white;
const BAND_HEIGHT = 14;

function bakeNebula(scene: Phaser.Scene, key: string, count: number, radius: number): void {
  // White blobs: the layer is tinted, and the tint slowly shifts (docs/06, section 5).
  bakeTexture(scene, key, TILE, TILE, (g) => {
    for (const { x, y } of scatterPoints(count, TILE)) {
      const r = radius * (0.7 + Math.random() * 0.5);
      tiled(TILE, x, y, r, (px, py) => glow(g, px, py, r, WHITE, 0.55));
    }
  });
}

function bakeLayers(scene: Phaser.Scene): void {
  bakeTexture(scene, P.dust, TILE, TILE, (g) => {
    scatterPoints(110, TILE).forEach(({ x, y }, i) => {
      const r = 1 + Math.random() * 1.2;
      g.fillStyle(i % 3 === 0 ? C.dust : C.star, 0.6);
      tiled(TILE, x, y, r, (px, py) => g.fillCircle(px, py, r));
    });
  });
  bakeNebula(scene, P.nebula, 5, 170);
  bakeNebula(scene, P.nebulaTwo, 4, 200);
  bakeTexture(scene, P.sparkles, TILE, TILE, (g) => {
    scatterPoints(10, TILE).forEach(({ x, y }, i) => {
      const r = 8 + (i % 3) * 5;
      tiled(TILE, x, y, r, (px, py) => sparkle(g, px, py, r, C.star, 0.9));
    });
    g.fillStyle(C.rock, 0.8);
    for (const { x, y } of scatterPoints(14, TILE)) {
      const r = 3 + Math.random() * 3;
      tiled(TILE, x, y, r, (px, py) => g.fillCircle(px, py, r));
    }
  });
}

/** Horizontal stripes of a ball, each as wide as the ball is at that height. */
function bands(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  offsets: number[],
): void {
  g.fillStyle(color, 0.85);
  for (const dy of offsets) {
    const far = Math.max(Math.abs(dy), Math.abs(dy + BAND_HEIGHT));
    const half = Math.sqrt(radius * radius - far * far);
    g.fillRect(cx - half, cy + dy, half * 2, BAND_HEIGHT);
  }
}

function bakePlanets(scene: Phaser.Scene): void {
  bakeTexture(scene, P.planetA, 260, 170, (g) => {
    g.fillStyle(C.planetA, 1);
    g.fillCircle(130, 85, 66);
    bands(g, 130, 85, 66, C.planetABand, [-36, -8, 22]);
    g.fillStyle(WHITE, 0.25);
    g.fillCircle(110, 62, 14);
    g.lineStyle(10, C.ring, 1);
    g.strokeEllipse(130, 94, 248, 56);
  });
  bakeTexture(scene, P.planetB, 150, 150, (g) => {
    g.fillStyle(C.planetB, 1);
    g.fillCircle(75, 75, 64);
    bands(g, 75, 75, 64, C.planetBBand, [-40, -12, 24]);
    g.fillStyle(C.planetBBand, 0.8);
    g.fillCircle(100, 46, 9);
    g.fillCircle(48, 100, 12);
    g.fillStyle(WHITE, 0.25);
    g.fillCircle(52, 48, 12);
  });
}

function bakeTravelers(scene: Phaser.Scene): void {
  bakeTexture(scene, P.satellite, 140, 70, (g) => {
    g.lineStyle(3, C.satellite, 1);
    g.lineBetween(70, 20, 70, 4);
    g.fillStyle(C.light, 1);
    g.fillCircle(70, 5, 4);
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(4, 24, 44, 26, 4);
    g.fillRoundedRect(92, 24, 44, 26, 4);
    g.fillStyle(WHITE, 0.35);
    for (const x of [18, 33, 106, 121]) g.fillRect(x, 24, 2, 26);
    g.fillStyle(C.satellite, 1);
    g.fillRoundedRect(50, 20, 40, 34, 8);
    g.fillRect(46, 35, 8, 4);
    g.fillRect(86, 35, 8, 4);
    g.fillStyle(C.panel, 0.7);
    g.fillCircle(70, 37, 8);
  });
  bakeTexture(scene, P.comet, 240, 44, (g) => {
    g.fillStyle(C.cometTail, 0.2);
    for (const [length, half] of [
      [216, 9],
      [160, 12],
      [110, 15],
      [60, 17],
    ] as const) {
      g.fillTriangle(216 - length, 22, 216, 22 - half, 216, 22 + half);
    }
    glow(g, 216, 22, 22, C.cometHead, 0.8);
    g.fillStyle(C.cometHead, 1);
    g.fillCircle(216, 22, 12);
  });
}

/** Space: dust, two nebulae that slowly change colour, planets, a satellite and a comet. */
export const spaceArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakePlanets(scene);
    bakeTravelers(scene);
  },
  build(scene) {
    const life = BACKDROP_LIFE.space;
    return {
      layers: [P.dust, P.nebula, P.nebulaTwo, P.sparkles],
      lives: [
        { slot: 2, life: new Hover(scene, life.planets) },
        { slot: 2, life: new Traveler(scene, life.satellite) },
        { slot: 3, life: new Traveler(scene, life.comet) },
      ],
    };
  },
};

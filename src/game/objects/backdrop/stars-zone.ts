import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';
import { glow, scatterPoints, sparkle, tiled } from './art-kit';
import { Hover, Traveler, Twinkles } from './life';
import type { ZoneArt } from './zone-scenery';

const TILE = 512;
const T = BD_TEX.stars;
const C = BACKDROP_COLORS.stars;
const SHOOTING = { width: 180, height: 14, headX: 172 };
const MOON = { size: 240, radius: 110 };

function bakeDots(
  scene: Phaser.Scene,
  key: string,
  count: number,
  radius: readonly [number, number],
  alpha: number,
  colors: readonly number[],
): void {
  bakeTexture(scene, key, TILE, TILE, (g) => {
    scatterPoints(count, TILE).forEach(({ x, y }, i) => {
      const r = radius[0] + Math.random() * (radius[1] - radius[0]);
      g.fillStyle(colors[i % colors.length] ?? C.star, alpha);
      tiled(TILE, x, y, r, (px, py) => g.fillCircle(px, py, r));
    });
  });
}

function bakeLayers(scene: Phaser.Scene): void {
  bakeDots(scene, T.dust, 90, [1, 2], 0.6, [C.star]);
  bakeDots(scene, T.mid, 26, [2, 3.5], 0.85, [C.star, C.warm]);
  bakeTexture(scene, T.sparkles, TILE, TILE, (g) => {
    scatterPoints(8, TILE).forEach(({ x, y }, i) => {
      const r = 10 + (i % 3) * 6;
      tiled(TILE, x, y, r, (px, py) => sparkle(g, px, py, r, i % 2 === 0 ? C.star : C.warm, 0.9));
    });
  });
  bakeTexture(scene, T.glow, TILE, TILE, (g) => {
    for (const { x, y } of scatterPoints(4, TILE)) {
      tiled(TILE, x, y, 130, (px, py) => glow(g, px, py, 120, C.glow, 0.16));
    }
  });
}

function bakeShootingStar(scene: Phaser.Scene): void {
  const { width, height, headX } = SHOOTING;
  bakeTexture(scene, T.shooting, width, height, (g) => {
    g.fillStyle(C.shooting, 0.22);
    for (const length of [width, width * 0.75, width * 0.5, width * 0.25]) {
      g.fillTriangle(headX - length, height / 2, headX, 1, headX, height - 1);
    }
    glow(g, headX, height / 2, height / 2, C.shooting, 0.8);
    g.fillStyle(C.shooting, 1);
    g.fillCircle(headX, height / 2, 4);
  });
}

function bakeMoon(scene: Phaser.Scene): void {
  const mid = MOON.size / 2;
  bakeTexture(scene, T.moon, MOON.size, MOON.size, (g) => {
    g.fillStyle(C.moon, 1);
    g.fillCircle(mid, mid, MOON.radius);
    g.fillStyle(C.moonCrater, 0.7);
    g.fillCircle(mid - 52, mid - 58, 18);
    g.fillCircle(mid + 56, mid - 34, 12);
    g.fillCircle(mid + 30, mid + 62, 16);
    g.fillStyle(C.moonCheek, 0.7);
    g.fillEllipse(mid - 62, mid + 30, 34, 20);
    g.fillEllipse(mid + 62, mid + 30, 34, 20);
    g.lineStyle(6, C.moonFace, 1);
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const a0 = Math.PI * (0.2 + (0.6 * i) / steps);
      const a1 = Math.PI * (0.2 + (0.6 * (i + 1)) / steps);
      g.lineBetween(
        mid + Math.cos(a0) * 26,
        mid + 14 + Math.sin(a0) * 22,
        mid + Math.cos(a1) * 26,
        mid + 14 + Math.sin(a1) * 22,
      );
    }
  });
  bakeTexture(scene, T.eye, 22, 28, (g) => {
    g.fillStyle(C.moonFace, 1);
    g.fillEllipse(11, 14, 18, 24);
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillCircle(14, 8, 4);
  });
}

/** Night: dust of stars, twinkling sparkles, a shooting star now and then and a moon with a face. */
export const starsArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakeShootingStar(scene);
    bakeMoon(scene);
  },
  build(scene) {
    const life = BACKDROP_LIFE.stars;
    return {
      layers: [T.dust, T.mid, T.sparkles, T.glow],
      lives: [
        { slot: 1, life: new Hover(scene, [life.glow, life.moon, ...life.eyes]) },
        { slot: 2, life: new Twinkles(scene, life.twinkle) },
        { slot: 2, life: new Traveler(scene, life.shooting) },
      ],
    };
  },
};

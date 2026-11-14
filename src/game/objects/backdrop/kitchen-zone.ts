import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { KITCHEN_COLORS, PALETTE } from '../../../data/palette';
import { shade } from '../../../util/color';
import { bakeTexture } from '../../ui/bake-texture';
import { Hover, PuffColumn, Traveler } from './life';
import type { ZoneArt } from './zone-scenery';

const TILE = 512;
const TILE_SIZE = 128;
const TILE_ALPHA = 0.55;
const TILE_GAP = 6;
const K = BD_TEX.kitchen;
const C = BACKDROP_COLORS.kitchen;

function bakeLayers(scene: Phaser.Scene): void {
  bakeTexture(scene, K.wallpaper, TILE, TILE, (g) => {
    g.fillStyle(shade(KITCHEN_COLORS.wall, 0.25), 0.7);
    for (let y = 64; y < TILE; y += 128) {
      for (let x = 64; x < TILE; x += 128) {
        g.fillCircle(x + ((y / 128) % 2) * 64, y, 9);
      }
    }
  });

  bakeTexture(scene, K.tiles, TILE, TILE, (g) => {
    g.fillStyle(KITCHEN_COLORS.tiles, TILE_ALPHA);
    for (let y = 0; y < TILE; y += TILE_SIZE) {
      for (let x = 0; x < TILE; x += TILE_SIZE) {
        g.fillRoundedRect(
          x + TILE_GAP / 2,
          y + TILE_GAP / 2,
          TILE_SIZE - TILE_GAP,
          TILE_SIZE - TILE_GAP,
          14,
        );
      }
    }
  });

  bakeTexture(scene, K.shelves, TILE, TILE, (g) => {
    const plankY = 400;
    const jars = [
      { x: 110, h: 110, w: 84, color: PALETTE.accent },
      { x: 250, h: 84, w: 100, color: PALETTE.gold },
      { x: 400, h: 130, w: 76, color: PALETTE.success },
    ];
    for (const jar of jars) {
      const top = plankY - jar.h;
      g.fillStyle(shade(jar.color, -0.3), 1);
      g.fillRoundedRect(jar.x - jar.w / 2 - 4, top - 4, jar.w + 8, jar.h + 4, 16);
      g.fillStyle(jar.color, 0.9);
      g.fillRoundedRect(jar.x - jar.w / 2, top, jar.w, jar.h, 12);
      g.fillStyle(shade(KITCHEN_COLORS.shelf, -0.2), 1);
      g.fillRoundedRect(jar.x - jar.w / 2 + 8, top - 18, jar.w - 16, 20, 8);
      g.fillStyle(PALETTE.textLight, 0.4);
      g.fillRoundedRect(jar.x - jar.w / 2 + 10, top + 12, 10, jar.h * 0.5, 5);
    }
    g.fillStyle(shade(KITCHEN_COLORS.shelf, -0.25), 1);
    g.fillRoundedRect(0, plankY, TILE, 34, 10);
    g.fillStyle(KITCHEN_COLORS.shelf, 1);
    g.fillRoundedRect(0, plankY, TILE, 24, 10);
  });

  bakeTexture(scene, K.utensils, TILE, TILE, (g) => {
    g.fillStyle(shade(KITCHEN_COLORS.counter, -0.15), 0.55);
    g.fillRoundedRect(60, 40, 10, 150, 5);
    g.fillCircle(65, 220, 34);
    g.fillRoundedRect(330, 90, 10, 190, 5);
    g.fillRoundedRect(310, 250, 50, 70, 25);
    g.fillRoundedRect(440, 20, 10, 120, 5);
    g.fillCircle(445, 170, 26);
  });
}

function bakePot(scene: Phaser.Scene): void {
  bakeTexture(scene, K.pot, 200, 170, (g) => {
    g.fillStyle(shade(KITCHEN_COLORS.shelf, -0.25), 1);
    g.fillRoundedRect(0, 148, 200, 22, 8);
    g.fillStyle(KITCHEN_COLORS.shelf, 1);
    g.fillRoundedRect(0, 148, 200, 16, 8);
    g.fillStyle(C.potDark, 1);
    g.fillRoundedRect(4, 88, 22, 14, 7);
    g.fillRoundedRect(174, 88, 22, 14, 7);
    g.fillRoundedRect(22, 62, 156, 92, 26);
    g.fillStyle(C.pot, 1);
    g.fillRoundedRect(26, 62, 148, 84, 24);
    g.fillStyle(C.potDark, 1);
    g.fillRoundedRect(14, 54, 172, 18, 8);
    g.fillStyle(C.pot, 1);
    g.fillRoundedRect(16, 54, 168, 12, 6);
    g.fillStyle(PALETTE.textLight, 0.35);
    g.fillRoundedRect(38, 78, 12, 52, 6);
  });
  bakeTexture(scene, K.lid, 150, 44, (g) => {
    g.fillStyle(C.potDark, 1);
    g.fillRoundedRect(6, 22, 138, 16, 8);
    g.fillEllipse(75, 22, 110, 34);
    g.fillCircle(75, 6, 7);
    g.fillStyle(C.pot, 1);
    g.fillRoundedRect(8, 22, 134, 11, 6);
    g.fillEllipse(75, 22, 104, 28);
    g.fillCircle(75, 6, 5);
  });
}

function bakeRack(scene: Phaser.Scene): void {
  bakeTexture(scene, K.ladle, 44, 240, (g) => {
    g.fillStyle(C.ladleDark, 1);
    g.fillRoundedRect(16, 0, 12, 182, 6);
    g.fillEllipse(22, 208, 46, 60);
    g.fillStyle(C.ladle, 1);
    g.fillRoundedRect(18, 2, 8, 180, 4);
    g.fillEllipse(22, 208, 40, 54);
    g.fillStyle(C.ladleDark, 0.5);
    g.fillEllipse(22, 212, 28, 36);
    g.fillCircle(22, 14, 4);
  });
  bakeTexture(scene, K.rail, 230, 22, (g) => {
    g.fillStyle(shade(C.rail, -0.25), 1);
    g.fillRoundedRect(0, 5, 230, 12, 6);
    g.fillStyle(C.rail, 1);
    g.fillRoundedRect(0, 5, 230, 8, 4);
    g.fillStyle(shade(C.rail, -0.25), 1);
    for (const x of [49, 115, 181]) g.fillCircle(x, 17, 5);
  });
}

function bakeClock(scene: Phaser.Scene): void {
  bakeTexture(scene, K.clock, 180, 300, (g) => {
    g.fillStyle(C.clockRim, 1);
    g.fillRoundedRect(0, 0, 180, 300, 40);
    g.fillStyle(C.clockCase, 1);
    g.fillRoundedRect(6, 6, 168, 288, 36);
    g.fillStyle(C.clockRim, 1);
    g.fillCircle(90, 90, 68);
    g.fillStyle(C.clockFace, 1);
    g.fillCircle(90, 90, 60);
    g.fillStyle(BACKDROP_COLORS.shared.ink, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.fillCircle(90 + Math.sin(a) * 48, 90 - Math.cos(a) * 48, i % 3 === 0 ? 4 : 2.5);
    }
    g.fillCircle(90, 90, 5);
    g.fillStyle(C.clockRim, 1);
    g.fillRoundedRect(44, 170, 92, 116, 16);
    g.fillStyle(shade(C.clockRim, -0.3), 1);
    g.fillRoundedRect(48, 174, 84, 108, 13);
  });
  bakeTexture(scene, K.hand, 10, 52, (g) => {
    g.fillStyle(BACKDROP_COLORS.shared.ink, 1);
    g.fillRoundedRect(2, 0, 6, 52, 3);
  });
  bakeTexture(scene, K.pendulum, 20, 104, (g) => {
    g.fillStyle(shade(C.pendulum, -0.4), 1);
    g.fillRoundedRect(8, 0, 4, 82, 2);
    g.fillCircle(10, 88, 15);
    g.fillStyle(C.pendulum, 1);
    g.fillCircle(10, 88, 12);
    g.fillStyle(PALETTE.textLight, 0.5);
    g.fillCircle(6, 84, 4);
  });
}

function bakeFly(scene: Phaser.Scene): void {
  bakeTexture(scene, K.fly, 40, 30, (g) => {
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.75);
    g.fillEllipse(14, 8, 16, 10);
    g.fillEllipse(26, 8, 16, 10);
    g.fillStyle(C.fly, 1);
    g.fillEllipse(20, 18, 24, 14);
    g.fillCircle(9, 18, 5);
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillCircle(7, 16, 1.6);
  });
}

/** Kitchen: wallpaper, tiles, shelves and utensils, with steam, ladles, a clock and a fly. */
export const kitchenArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakePot(scene);
    bakeRack(scene);
    bakeClock(scene);
    bakeFly(scene);
  },
  build(scene) {
    const life = BACKDROP_LIFE.kitchen;
    const steam = new PuffColumn(scene, life.steam, life.steamAt, life.steamOffset);
    return {
      layers: [K.wallpaper, K.tiles, K.shelves, K.utensils],
      lives: [
        { slot: 1, life: new Hover(scene, [life.pot, life.clock, life.rail]) },
        { slot: 1, life: new Hover(scene, [life.clockHand, life.pendulum]) },
        { slot: 1, life: new Hover(scene, life.ladles) },
        { slot: 1, life: new Hover(scene, [life.lid]) },
        { slot: 1, life: steam },
        { slot: 3, life: new Traveler(scene, life.fly) },
      ],
    };
  },
};

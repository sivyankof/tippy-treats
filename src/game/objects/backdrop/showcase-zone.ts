import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE, garlandWireY } from '../../../data/backdrop-life';
import { LOGICAL_SIZE } from '../../../data/screen';
import { shade } from '../../../util/color';
import { bakeTexture } from '../../ui/bake-texture';
import { glow, tiled } from './art-kit';
import { Hover, Traveler, Twinkles } from './life';
import type { ZoneArt } from './zone-scenery';

type Graphics = Phaser.GameObjects.Graphics;

const TILE = 512;
const S = BD_TEX.showcase;
const C = BACKDROP_COLORS.showcase;
/** Where on the wire texture the string hangs at its anchors. */
const WIRE_TOP = 6;
const WIRE_STEPS = 48;

const BUILDINGS = [
  { x: 30, y: 60, w: 110, h: 200 },
  { x: 170, y: 200, w: 90, h: 250 },
  { x: 300, y: 20, w: 120, h: 160 },
  { x: 380, y: 300, w: 110, h: 190 },
  { x: 60, y: 330, w: 100, h: 150 },
  { x: 230, y: 440, w: 70, h: 60 },
];
const TREAT_X = [60, 150, 260, 350, 450];

/** A slanted band of light on the glass: top edge at (`x`, `y`) `width` wide, `height` tall, leaning by `lean`. */
function glint(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  lean: number,
): void {
  g.fillTriangle(x, y, x + width, y, x + lean, y + height);
  g.fillTriangle(x + width, y, x + lean + width, y + height, x + lean, y + height);
}

function bakeLayers(scene: Phaser.Scene): void {
  bakeTexture(scene, S.street, TILE, TILE, (g) => {
    for (const b of BUILDINGS) {
      tiled(TILE, b.x, b.y, Math.max(b.w, b.h), (x, y) => {
        g.fillStyle(C.building, 0.7);
        g.fillRoundedRect(x, y, b.w, b.h, 12);
        g.fillStyle(C.buildingWindow, 0.8);
        for (let wy = y + 16; wy < y + b.h - 24; wy += 34) {
          for (let wx = x + 14; wx < x + b.w - 22; wx += 30) g.fillRoundedRect(wx, wy, 16, 20, 4);
        }
      });
    }
  });

  bakeTexture(scene, S.panes, TILE, TILE, (g) => {
    g.fillStyle(C.frame, 0.9);
    g.fillRect(0, 0, TILE, 14);
    g.fillRect(0, 0, 14, TILE);
    g.fillRect(TILE / 2, 0, 14, TILE);
    g.fillStyle(C.glint, 0.22);
    glint(g, 100, 40, 50, 260, -80);
    glint(g, 340, 120, 30, 210, -60);
  });

  bakeTexture(scene, S.treats, TILE, TILE, (g) => {
    g.fillStyle(shade(C.shelf, -0.25), 1);
    g.fillRoundedRect(0, 386, TILE, 26, 10);
    g.fillStyle(C.shelf, 1);
    g.fillRoundedRect(0, 386, TILE, 18, 10);
    TREAT_X.forEach((x, i) => {
      const color = C.treat[i % C.treat.length] ?? C.glaze;
      g.fillStyle(shade(color, -0.25), 1);
      g.fillRoundedRect(x - 26, 352, 52, 34, 8);
      g.fillStyle(color, 1);
      g.fillCircle(x, 344, 30);
      g.fillStyle(BACKDROP_COLORS.shared.white, 0.45);
      g.fillCircle(x - 10, 334, 8);
    });
  });

  bakeTexture(scene, S.awning, TILE, TILE, (g) => {
    const stripe = 64;
    for (let x = 0; x < TILE; x += stripe) {
      g.fillStyle((x / stripe) % 2 === 0 ? C.awningA : C.awningB, 0.9);
      g.fillRect(x, 0, stripe, 64);
      g.fillCircle(x + stripe / 2, 64, stripe / 2);
    }
  });
}

function bakeGarland(scene: Phaser.Scene): void {
  const width = LOGICAL_SIZE.width;
  bakeTexture(scene, S.wire, width, BACKDROP_LIFE.showcase.garland.wireHeight, (g) => {
    g.lineStyle(4, C.wire, 1);
    for (let i = 0; i < WIRE_STEPS; i++) {
      const x0 = i / WIRE_STEPS;
      const x1 = (i + 1) / WIRE_STEPS;
      g.lineBetween(
        x0 * width,
        WIRE_TOP + garlandWireY(x0),
        x1 * width,
        WIRE_TOP + garlandWireY(x1),
      );
    }
  });
  bakeTexture(scene, S.bulb, 30, 40, (g) => {
    glow(g, 15, 24, 15, BACKDROP_COLORS.shared.white, 0.6);
    g.fillStyle(C.wire, 1);
    g.fillRoundedRect(10, 0, 10, 10, 3);
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillEllipse(15, 24, 20, 26);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.6);
    g.fillEllipse(10, 18, 5, 8);
  });
}

function bakeWindowLife(scene: Phaser.Scene): void {
  bakeTexture(scene, S.walker, 70, 190, (g) => {
    g.fillStyle(C.walker, 1);
    g.fillCircle(35, 26, 20);
    g.fillRoundedRect(12, 50, 46, 92, 20);
    g.fillRoundedRect(18, 128, 14, 60, 6);
    g.fillRoundedRect(38, 128, 14, 60, 6);
  });
  bakeTexture(scene, S.stand, 220, 50, (g) => {
    g.fillStyle(shade(C.standBase, -0.12), 1);
    g.fillEllipse(110, 44, 130, 14);
    g.fillRoundedRect(98, 12, 24, 32, 6);
    g.fillStyle(C.standBase, 1);
    g.fillEllipse(110, 22, 210, 28);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.4);
    g.fillEllipse(110, 18, 180, 12);
  });
  bakeTexture(scene, S.cake, 180, 130, (g) => {
    g.fillStyle(shade(C.cake, -0.2), 1);
    g.fillRoundedRect(8, 38, 164, 84, 26);
    g.fillStyle(C.cake, 1);
    g.fillRoundedRect(10, 38, 160, 78, 24);
    g.fillStyle(C.glaze, 1);
    g.fillRoundedRect(6, 26, 168, 44, 22);
    for (const x of [30, 78, 140]) g.fillRoundedRect(x, 56, 18, 34, 9);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.4);
    g.fillRoundedRect(20, 32, 60, 8, 4);
    g.fillStyle(C.cherry, 1);
    g.fillCircle(90, 20, 14);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.6);
    g.fillCircle(85, 15, 4);
  });
  bakeTexture(scene, S.sprinkle, 24, 10, (g) => {
    g.fillStyle(BACKDROP_COLORS.shared.white, 1);
    g.fillRoundedRect(0, 0, 24, 10, 5);
  });
}

/** Shop window: street behind glass, a blinking garland, passers-by and a turning cake. */
export const showcaseArt: ZoneArt = {
  bake(scene) {
    bakeLayers(scene);
    bakeGarland(scene);
    bakeWindowLife(scene);
  },
  build(scene) {
    const life = BACKDROP_LIFE.showcase;
    return {
      layers: [S.street, S.panes, S.treats, S.awning],
      lives: [
        ...life.walkers.map((spec) => ({ slot: 0, life: new Traveler(scene, spec) })),
        { slot: 2, life: new Hover(scene, [life.garland.wire]) },
        { slot: 2, life: new Twinkles(scene, life.garland.bulbs) },
        { slot: 2, life: new Hover(scene, [life.cakeStand, life.cake, ...life.sprinkles]) },
      ],
    };
  },
};

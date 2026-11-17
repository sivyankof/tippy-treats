import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { KITCHEN_COLORS, PALETTE } from '../../../data/palette';
import { mixColor, shade } from '../../../util/color';
import { outlineColor } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { drawPlank } from './art-kit';
import { inSky, onLayer } from './layer-anchor';
import { Hover, PuffColumn, Traveler } from './life';
import { LayerThing } from './layer-life';
import type { ZoneArt } from './zone-scenery';
import { RunOnly, bakeGlassItems, bakeWindow, windowGlassLives } from './window-weather';
import { KITCHEN_SHELF, WALL_LOOK, WINDOW_LOOK, windowKey } from '../../../data/window-look';

const TILE = 512;
const TILE_SIZE = 128;
const TILE_ALPHA = 0.55;
const TILE_GAP = 6;
const K = BD_TEX.kitchen;
const C = BACKDROP_COLORS.kitchen;

const SHELF = KITCHEN_SHELF;
/** The clock, the pot and the ladle rail hang on the wall with the shelves (the same layer as the window), drawn above the utensils layer (slot 3) so nothing crosses over them. */
const KITCHEN_LAYER = WALL_LOOK.layer;
const JAR_LOWER = 0.38;
const JAR_PAD = 26;

/** The jar on its own bracket in the house style: dark outline of its own colour, two tones, a lid and a gloss mark. Muted towards the wall. */
function bakeJar(scene: Phaser.Scene): void {
  const { w, h, color: base, mute, board } = SHELF.jar;
  const width = board + 8;
  const height = h + JAR_PAD + 40;
  bakeTexture(scene, JAR_KEY, width, height, (g) => {
    const color = mixColor(base, KITCHEN_COLORS.wall, mute);
    const plankY = JAR_PAD + h;
    const left = width / 2 - w / 2;
    const top = JAR_PAD;
    const lid = shade(KITCHEN_COLORS.shelf, -0.2);
    g.fillStyle(outlineColor(color), 1);
    g.fillRoundedRect(left - 4, top - 4, w + 8, h + 4, 18);
    g.fillStyle(color, 1);
    g.fillRoundedRect(left, top, w, h, 14);
    g.fillStyle(shade(color, -0.13), 1);
    g.fillRoundedRect(left, top + h * (1 - JAR_LOWER), w, h * JAR_LOWER, {
      tl: 0,
      tr: 0,
      bl: 14,
      br: 14,
    });
    g.fillStyle(outlineColor(lid), 1);
    g.fillRoundedRect(left + 6, top - 22, w - 12, 24, 9);
    g.fillStyle(lid, 1);
    g.fillRoundedRect(left + 9, top - 19, w - 18, 16, 7);
    g.fillStyle(PALETTE.textLight, 0.42);
    g.fillRoundedRect(left + 11, top + 12, 9, h * 0.46, 4.5);
    g.fillCircle(left + 15.5, top + 12 + h * 0.46 + 10, 4.5);
    drawPlank(g, 'bracket', 4, plankY, board, KITCHEN_COLORS.shelf);
  });
}

const JAR_KEY = 'bd_win_kjar';

/** The boards across the wall; none stands near the chip of the start view (see `KITCHEN_SHELF`). */
function bakeShelves(scene: Phaser.Scene): void {
  bakeTexture(scene, K.shelves, TILE, TILE, (g) => {
    drawPlank(g, 'shelf', -20, SHELF.plank, TILE + 40, KITCHEN_COLORS.shelf);
  });
}

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

/** The fly of the kitchen (also the guest of the shop: one picture, one spec). */
export function bakeFly(scene: Phaser.Scene): void {
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
  bake(scene, look) {
    bakeWindow(scene, 'kitchen', look.weather);
    bakeGlassItems(scene, look.weather);
    bakeLayers(scene);
    bakeShelves(scene);
    bakeJar(scene);
    bakePot(scene);
    bakeRack(scene);
    bakeClock(scene);
    bakeFly(scene);
  },
  build(scene, look) {
    const life = BACKDROP_LIFE.kitchen;
    // The window and the jar hang on the wall with the shelves: they ride with it (layer-life.ts).
    const window = new LayerThing(
      scene,
      [
        {
          texture: windowKey('kitchen', look.weather),
          at: WINDOW_LOOK.kitchen.at,
          offset: WINDOW_LOOK.kitchen.offset,
          pulse: WINDOW_LOOK.pulse,
        },
      ],
      {
        layer: WALL_LOOK.layer,
        series: WALL_LOOK.window,
        mirror: true,
        halfH: WINDOW_LOOK.height / 2,
      },
    );
    const jar = new LayerThing(
      scene,
      [{ texture: JAR_KEY, at: SHELF.jar.at, offset: { x: 0, y: 0 }, pulse: WINDOW_LOOK.pulse }],
      { layer: WALL_LOOK.layer, series: WALL_LOOK.jar, halfH: (SHELF.jar.h + JAR_PAD + 40) / 2 },
    );
    const glass = windowGlassLives(scene, 'kitchen', look.weather, window.spots);
    const steam = new PuffColumn(
      scene,
      life.steam,
      onLayer(KITCHEN_LAYER),
      life.steamAt,
      life.steamOffset,
    );
    const fly = new Traveler(scene, life.fly, inSky('traveler'));
    return {
      layers: [K.wallpaper, K.tiles, K.shelves, K.utensils],
      lives: [
        {
          slot: 3,
          life: new Hover(scene, [life.pot, life.clock, life.rail], onLayer(KITCHEN_LAYER)),
        },
        {
          slot: 3,
          life: new Hover(scene, [life.clockHand, life.pendulum], onLayer(KITCHEN_LAYER)),
        },
        { slot: 3, life: new Hover(scene, life.ladles, onLayer(KITCHEN_LAYER)) },
        { slot: 3, life: new Hover(scene, [life.lid], onLayer(KITCHEN_LAYER)) },
        { slot: 3, life: steam },
        { slot: 3, life: new RunOnly([window, ...glass, jar], onLayer(WALL_LOOK.layer)) },
        { slot: 3, life: fly },
      ],
      guest: fly,
    };
  },
};

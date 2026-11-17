import type * as Phaser from 'phaser';
import {
  SHOP_COLORS,
  SHOP_LOOK,
  SHOP_TEX,
  WINDOW_LOOK,
  windowKey,
} from '../../../data/window-look';
import { mixColor, shade } from '../../../util/color';
import { outlineColor } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { Hover } from './life';
import { bakeStopsSky, type ZoneArt } from './zone-scenery';
import { bakeGlassItems, bakeWindow, windowGlassLife } from './window-weather';

type Graphics = Phaser.GameObjects.Graphics;

const TILE = SHOP_LOOK.tile;
const C = SHOP_COLORS;
const PLANK_Y = 410;
const OUTLINE = 4;

/** A body with the dark outline of its own colour: the outline shape is drawn first, `fill` on top. */
function outlined(g: Graphics, color: number, outline: (grow: number) => void): void {
  g.fillStyle(outlineColor(color), 1);
  outline(OUTLINE);
  g.fillStyle(color, 1);
  outline(0);
}

function macaron(g: Graphics, x: number, color: number, w: number): void {
  const shell = w * 0.36;
  const cream = C.sweets.cream;
  const top = PLANK_Y - w * 0.8;
  const parts: [number, number][] = [
    [top + shell / 2, shell],
    [PLANK_Y - shell / 2, shell],
  ];
  for (const [cy, h] of parts) {
    outlined(g, color, (grow) => g.fillEllipse(x, cy, w + grow * 2, h + grow * 2));
  }
  const gap = PLANK_Y - shell - (top + shell);
  outlined(g, cream, (grow) =>
    g.fillRoundedRect(
      x - w * 0.43 - grow,
      top + shell - 2 - grow,
      w * 0.86 + grow * 2,
      gap + 4 + grow * 2,
      8,
    ),
  );
  g.fillStyle(shade(color, 0.28), 0.8);
  g.fillEllipse(x - w * 0.18, top + shell * 0.36, w * 0.32, shell * 0.26);
}

function candy(g: Graphics, x: number, color: number, r: number): void {
  const cy = PLANK_Y - r;
  outlined(g, color, (grow) => g.fillCircle(x, cy, r + grow));
  g.fillStyle(shade(color, 0.2), 1);
  g.fillCircle(x + r * 0.05, cy + r * 0.05, r * 0.6);
  g.fillStyle(shade(color, -0.1), 1);
  g.fillCircle(x + r * 0.05, cy + r * 0.05, r * 0.3);
  g.fillStyle(0xffffff, 0.5);
  g.fillRoundedRect(x - r * 0.72, cy - r * 0.55, r * 0.16, r * 0.62, r * 0.08);
}

function cake(g: Graphics, x: number, w: number, h: number): void {
  const top = PLANK_Y - h;
  outlined(g, C.sweets.cake, (grow) =>
    g.fillRoundedRect(x - w / 2 - grow, top + h * 0.3 - grow, w + grow * 2, h * 0.7 + grow, 14),
  );
  g.fillStyle(shade(C.sweets.cake, -0.1), 1);
  g.fillRoundedRect(x - w / 2, PLANK_Y - h * 0.22, w, h * 0.22, { tl: 0, tr: 0, bl: 14, br: 14 });
  outlined(g, C.sweets.glaze, (grow) =>
    g.fillRoundedRect(
      x - w / 2 - 4 - grow,
      top - grow,
      w + 8 + grow * 2,
      h * 0.42 + grow * 2,
      h * 0.21,
    ),
  );
  g.fillStyle(C.sweets.glaze, 1);
  for (const dx of [-0.28, 0.1, 0.34]) {
    g.fillRoundedRect(x + w * dx - 8, top + h * 0.3, 16, h * 0.3, 8);
  }
  g.fillStyle(0xffffff, 0.5);
  g.fillRoundedRect(x - w * 0.36, top + 6, w * 0.34, 6, 3);
}

function bakeWall(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.wall, TILE, TILE, (g) => {
    g.fillStyle(C.stripe, 0.55);
    for (let x = 0; x < TILE; x += 128) g.fillRect(x + 32, 0, 64, TILE);
  });
  bakeTexture(scene, SHOP_TEX.lattice, TILE, TILE, (g) => {
    g.lineStyle(5, C.ring, 0.3);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * 128 + (row % 2) * 64 + 64;
        g.strokeCircle(x % TILE, row * 64 + 32, 64);
      }
    }
  });
}

function bakeShelves(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.shelves, TILE, TILE, (g) => {
    // A pale wash over the far silhouettes of the wall (they sit under this layer), so they take the pink of the shop.
    g.fillStyle(C.skyBottom, SHOP_LOOK.farWash);
    g.fillRect(0, 0, TILE, TILE);
    const mute = (color: number): number => mixColor(color, C.skyBottom, 0.12);
    macaron(g, 72, mute(C.sweets.macaron[0]), 92);
    candy(g, 190, mute(C.sweets.candy[1]), 40);
    cake(g, 318, 96, 84);
    macaron(g, 440, mute(C.sweets.macaron[1]), 84);
    g.fillStyle(shade(C.shelf, -0.25), 1);
    g.fillRoundedRect(0, PLANK_Y, TILE, 34, 10);
    g.fillStyle(C.shelf, 1);
    g.fillRoundedRect(0, PLANK_Y, TILE, 24, 10);
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(24, PLANK_Y + 4, 150, 5, 2.5);
  });
}

function bakeStands(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.stands, TILE, TILE, (g) => {
    g.fillStyle(C.silhouette, 0.55);
    for (const [x, y] of [
      [90, 280],
      [390, 120],
    ] as const) {
      g.fillRoundedRect(x - 6, y, 12, 70, 5);
      g.fillRoundedRect(x - 28, y + 66, 56, 12, 6);
      g.fillEllipse(x, y, 120, 14);
      g.beginPath();
      g.arc(x, y - 4, 48, Math.PI, 0);
      g.closePath();
      g.fillPath();
      g.fillCircle(x, y - 54, 7);
    }
  });
}

/** A striped awning strip: `TILE` wide so three of them cover the screen; its scallops hang below the stripes. */
function bakeAwning(scene: Phaser.Scene): void {
  const { height, stripe } = SHOP_LOOK.awning;
  bakeTexture(scene, SHOP_TEX.awning, TILE, height, (g) => {
    const body = height - stripe / 2 - OUTLINE;
    for (const [grow, pink, cream] of [
      [OUTLINE, outlineColor(C.awningPink), outlineColor(C.awningPink)],
      [0, C.awningPink, C.awningCream],
    ] as const) {
      for (let x = 0; x < TILE; x += stripe) {
        g.fillStyle((x / stripe) % 2 === 0 ? pink : cream, 1);
        g.fillRect(x, 0, stripe, body);
        g.fillCircle(x + stripe / 2, body, stripe / 2 + grow);
      }
    }
    g.fillStyle(shade(C.awningPink, -0.1), 1);
    g.fillRect(0, 0, TILE, 8);
    g.fillStyle(0xffffff, 0.35);
    for (let x = 0; x < TILE; x += stripe * 2) g.fillRoundedRect(x + 10, 14, 26, 5, 2.5);
  });
}

/** The confectioner's shop: a striped awning, shelves of round sweets and a window to the street with the sky of the weather. */
export const shopArt: ZoneArt = {
  bake(scene, look) {
    bakeStopsSky(scene, SHOP_TEX.sky, [
      { at: 0, color: C.skyTop },
      { at: 1, color: C.skyBottom },
    ]);
    bakeWindow(scene, 'shop', look.weather);
    bakeGlassItems(scene, look.weather);
    bakeWall(scene);
    bakeShelves(scene);
    bakeStands(scene);
    bakeAwning(scene);
  },
  build(scene, look) {
    const strips = [0, 1, 2].map((i) => ({
      texture: SHOP_TEX.awning,
      at: { x: 0, y: 0 },
      offset: { x: TILE * (i + 0.5), y: 0 },
      origin: [0.5, 0] as const,
    }));
    const awning = new Hover(scene, strips);
    const window = new Hover(scene, [
      {
        texture: windowKey('shop', look.weather),
        at: WINDOW_LOOK.shop.at,
        offset: WINDOW_LOOK.shop.offset,
      },
    ]);
    const glass = windowGlassLife(scene, 'shop', look.weather);
    return {
      layers: [SHOP_TEX.wall, SHOP_TEX.lattice, SHOP_TEX.shelves, SHOP_TEX.stands],
      lives: [
        { slot: 3, life: awning },
        { slot: 3, life: window },
        ...(glass ? [{ slot: 3, life: glass }] : []),
      ],
      sky: SHOP_TEX.sky,
    };
  },
};

import type * as Phaser from 'phaser';
import {
  SHOP_COLORS,
  SHOP_LOOK,
  SHOP_TEX,
  WALL_LOOK,
  WINDOW_LOOK,
  windowKey,
} from '../../../../data/weather/window-look';
import { mixColor, shade } from '../../../../util/color';
import { outlineColor } from '../../../fx/common/plain-style';
import { bakePadded, bakeTexture } from '../../../ui/common/bake-texture';
import { FIELD_PAD } from '../../../../data/common/picture-fields';
import { paddedOrigin } from '../../../../util/field-pad';
import { BACKDROP_LIFE } from '../../../../data/backdrop/backdrop-life';
import { OUTLINE, circle, drawPlank, ellipse, outlined, roundRect, tint } from '../common/art-kit';
import { inSky } from '../life/layer-anchor';
import { Traveler } from '../life/life';
import { LayerThing } from '../life/layer-life';
import { hangAlpha } from './shop-hang';
import { bakeDisplay, displayLife } from './shop-display';
import { bakeFly } from './kitchen-zone';
import { bakeStopsSky, type ZoneArt } from './zone-scenery';
import { bakeGlassItems, bakeWindow, windowGlassLives } from '../weather/window-weather';
import { bakePanoramaSet, panoramaLives, panoramaMissing } from '../panorama/panorama-window';

type Graphics = Phaser.GameObjects.Graphics;

const TILE = SHOP_LOOK.tile;
const C = SHOP_COLORS;
/** A macaron is this share of its width tall. */
const MACARON_HEIGHT = 0.8;

function macaron(g: Graphics, plankY: number, x: number, color: number, w: number): void {
  const shell = w * 0.36;
  const cream = C.sweets.cream;
  const top = plankY - w * MACARON_HEIGHT;
  const parts: [number, number][] = [
    [top + shell / 2, shell],
    [plankY - shell / 2, shell],
  ];
  for (const [cy, h] of parts) {
    outlined(g, color, ellipse(g, x, cy, w, h));
  }
  const gap = plankY - shell - (top + shell);
  outlined(g, cream, roundRect(g, x - w * 0.43, top + shell - 2, w * 0.86, gap + 4, 8));
  g.fillStyle(shade(color, 0.28), 0.8);
  g.fillEllipse(x - w * 0.18, top + shell * 0.36, w * 0.32, shell * 0.26);
}

function candy(g: Graphics, plankY: number, x: number, color: number, r: number): void {
  const cy = plankY - r;
  outlined(g, color, circle(g, x, cy, r));
  g.fillStyle(shade(color, 0.2), 1);
  g.fillCircle(x + r * 0.05, cy + r * 0.05, r * 0.6);
  g.fillStyle(shade(color, -0.1), 1);
  g.fillCircle(x + r * 0.05, cy + r * 0.05, r * 0.3);
  g.fillStyle(0xffffff, 0.5);
  g.fillRoundedRect(x - r * 0.72, cy - r * 0.55, r * 0.16, r * 0.62, r * 0.08);
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

/** The boards across the wall, under the pale wash that tints the far silhouettes pink; no sweets here (they scroll into the HUD). */
function bakeShelves(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.shelves, TILE, TILE, (g) => {
    g.fillStyle(C.skyBottom, SHOP_LOOK.farWash);
    g.fillRect(0, 0, TILE, TILE);
    drawPlank(g, 'shelf', -20, SHOP_LOOK.plank, TILE + 40, C.shelf);
  });
}

/** Height of a sweet above the bracket board: a candy is a circle of radius `size`, a macaron is 0.8 of its width tall. */
const sweetHeight = (item: (typeof SHOP_LOOK.sweets.items)[number]): number =>
  item.kind === 'candy' ? item.size * 2 : item.size * MACARON_HEIGHT;

/** The board line inside the sweets picture: the tallest sweet, its outline and a margin fit above it. */
const SWEETS_PAD = Math.ceil(
  Math.max(...SHOP_LOOK.sweets.items.map(sweetHeight)) + OUTLINE + SHOP_LOOK.sweets.edgePx,
);
/** Space under the board line: the board itself and its shade. */
const SWEETS_BELOW = 36;

/** A short bracket in the right outer column with a round candy and a macaron on it, muted towards the wall. */
function bakeSweets(scene: Phaser.Scene): void {
  const { board, mute, items } = SHOP_LOOK.sweets;
  const width = board + 8;
  const height = SWEETS_PAD + SWEETS_BELOW;
  bakeTexture(scene, SHOP_TEX.sweets, width, height, (g) => {
    items.forEach((item, i) => {
      const x = width / 2 + item.x;
      if (item.kind === 'candy') {
        candy(g, SWEETS_PAD, x, tint(C.sweets.candy[1], mute), item.size);
      } else {
        macaron(
          g,
          SWEETS_PAD,
          x,
          tint(C.sweets.macaron[(i + 1) % C.sweets.macaron.length] ?? 0, mute),
          item.size,
        );
      }
    });
    drawPlank(g, 'bracket', 4, SWEETS_PAD, board, C.shelf);
  });
}

function bakeStands(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.stands, TILE, TILE, (g) => {
    g.fillStyle(C.silhouette, 0.55);
    SHOP_LOOK.standsX.forEach((x, i) => {
      const y = i === 0 ? 280 : 120;
      g.fillRoundedRect(x - 6, y, 12, 70, 5);
      g.fillRoundedRect(x - 28, y + 66, 56, 12, 6);
      g.fillEllipse(x, y, 120, 14);
      g.beginPath();
      g.arc(x, y - 4, 48, Math.PI, 0);
      g.closePath();
      g.fillPath();
      g.fillCircle(x, y - 54, 7);
    });
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

/** A pendant lamp: a cord, a cap and a round pastel globe in two tones with a gloss mark inside a flat rim ring. */
function bakeLamp(scene: Phaser.Scene): void {
  const { width, height, cord, globe, rim } = SHOP_LOOK.lamp;
  const cx = width / 2;
  const cy = cord + globe;
  bakePadded(scene, SHOP_TEX.lamp, width, height, FIELD_PAD.shopLamp, (g) => {
    g.fillStyle(outlineColor(C.awningPink), 1);
    g.fillRect(cx - 2, 0, 4, cord);
    g.fillRoundedRect(cx - 9, cord - 6, 18, 12, 4);
    g.lineStyle(rim.width, rim.color, 1);
    g.strokeCircle(cx, cy, globe + rim.gap + rim.width / 2);
    outlined(g, C.sweets.glaze, circle(g, cx, cy, globe));
    g.fillStyle(shade(C.sweets.glaze, 0.35), 1);
    g.fillCircle(cx - 2, cy - 2, globe * 0.62);
    g.fillStyle(0xffffff, 0.6);
    g.fillRoundedRect(cx - globe * 0.7, cy - globe * 0.5, 6, globe * 0.6, 3);
  });
}

/** The confectioner's shop: a striped awning, shelves of round sweets and a window to the street with the sky of the weather. */
export const shopArt: ZoneArt = {
  ownSky: () => true,
  bake(scene, look) {
    bakeStopsSky(scene, SHOP_TEX.sky, [
      { at: 0, color: C.skyTop },
      { at: 1, color: C.skyBottom },
    ]);
    bakeWindow(scene, 'shop', look.weather);
    bakePanoramaSet(scene, 'shop', look.weather);
    bakeGlassItems(scene, look.weather);
    bakeWall(scene);
    bakeShelves(scene);
    bakeSweets(scene);
    bakeDisplay(scene);
    bakeStands(scene);
    bakeAwning(scene);
    bakeLamp(scene);
    bakeFly(scene);
  },
  build(scene, look) {
    const awningLook = SHOP_LOOK.awning;
    // The awning sways a little (it never stands still).
    // At night the awning is dimmed (a multiply tint).
    const dim =
      look.weather === 'night' ? mixColor(0xffffff, 0, SHOP_LOOK.awningNightDim) : undefined;
    const strips = Array.from({ length: awningLook.count }, (_, i) => ({
      texture: SHOP_TEX.awning,
      at: { x: 0, y: 0 },
      offset: { x: TILE * (i + 0.5), y: -awningLook.bobPx },
      origin: [0.5, 0] as const,
      bob: { px: awningLook.bobPx, ms: awningLook.bobMs },
      phase: i * awningLook.phaseStep,
      tint: dim,
    }));
    const lamp = SHOP_LOOK.lamp;
    const lamps = lamp.items.map((item, i) => ({
      texture: SHOP_TEX.lamp,
      at: { x: item.x, y: 0 },
      offset: { x: 0, y: awningLook.height - lamp.tuckPx + item.drop },
      origin: paddedOrigin([0.5, 0], lamp.width, lamp.height, FIELD_PAD.shopLamp),
      scale: lamp.scale,
      swing: { deg: lamp.swingDeg, ms: item.ms },
      phase: i * lamp.phaseStep,
    }));
    // Everything that hangs in the shop rides with the wall (layer-life.ts): the start awning and lamps scroll away with it.
    const awning = new LayerThing(scene, strips, {
      layer: WALL_LOOK.layer,
      halfH: awningLook.height,
      fadeDown: hangAlpha,
    });
    const window = new LayerThing(
      scene,
      [
        {
          texture: windowKey('shop', look.weather),
          at: WINDOW_LOOK.shop.at,
          offset: WINDOW_LOOK.shop.offset,
          pulse: WINDOW_LOOK.pulse,
        },
      ],
      {
        layer: WALL_LOOK.layer,
        series: WALL_LOOK.window,
        mirror: true,
        halfH: WINDOW_LOOK.height / 2,
        skipStart: (w, h) => !panoramaMissing(w, h),
      },
    );
    const sweets = new LayerThing(
      scene,
      [
        {
          texture: SHOP_TEX.sweets,
          at: SHOP_LOOK.sweets.at,
          offset: { x: 0, y: 0 },
          // Anchored on the board line, so a taller sweet grows upwards and the bracket stays put.
          origin: [0.5, SWEETS_PAD / (SWEETS_PAD + SWEETS_BELOW)] as const,
          pulse: WINDOW_LOOK.pulse,
        },
      ],
      { layer: WALL_LOOK.layer, series: WALL_LOOK.sweets, halfH: SWEETS_PAD + SWEETS_BELOW },
    );
    const glass = windowGlassLives(scene, 'shop', look.weather, window.spots);
    const fly = new Traveler(scene, BACKDROP_LIFE.kitchen.fly, inSky('traveler'));
    return {
      layers: [SHOP_TEX.wall, SHOP_TEX.lattice, SHOP_TEX.shelves, SHOP_TEX.stands],
      lives: [
        { slot: 3, life: awning },
        {
          slot: 3,
          life: new LayerThing(scene, lamps, {
            layer: WALL_LOOK.layer,
            halfH: lamp.height,
            fadeDown: hangAlpha,
          }),
        },
        ...panoramaLives(scene, 'shop', look.weather).map((life) => ({ slot: 3, life })),
        { slot: 3, life: window },
        ...glass.map((life) => ({ slot: 3, life })),
        { slot: 3, life: sweets },
        { slot: 3, life: displayLife(scene) },
        { slot: 3, life: fly },
      ],
      guest: fly,
      sky: SHOP_TEX.sky,
    };
  },
};

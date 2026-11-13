import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { KITCHEN_COLORS, PALETTE } from '../../data/palette';
import { mixColor, shade } from '../../util/color';
import { DEPTH } from '../depth';
import { bakeTexture } from '../ui/bake-texture';

const TEXTURES = {
  wallpaper: 'bg_wallpaper',
  tiles: 'bg_tiles',
  shelves: 'bg_shelves',
  utensils: 'bg_utensils',
} as const;

const SKY_BANDS = 48;
const COUNTER_TOP_HEIGHT = 40;
const COUNTER_DEPTH = 6000;
const TILE_SIZE = 128;
const TILE_ALPHA = 0.55;
const TILE_GAP = 6;

type ParallaxLayer = { sprite: Phaser.GameObjects.TileSprite; factor: number };

function createTextures(scene: Phaser.Scene): void {
  const size = 512;
  bakeTexture(scene, TEXTURES.wallpaper, size, size, (g) => {
    g.fillStyle(shade(KITCHEN_COLORS.wall, 0.25), 0.7);
    for (let y = 64; y < size; y += 128) {
      for (let x = 64; x < size; x += 128) {
        g.fillCircle(x + ((y / 128) % 2) * 64, y, 9);
      }
    }
  });

  bakeTexture(scene, TEXTURES.tiles, size, size, (g) => {
    g.fillStyle(KITCHEN_COLORS.tiles, TILE_ALPHA);
    for (let y = 0; y < size; y += TILE_SIZE) {
      for (let x = 0; x < size; x += TILE_SIZE) {
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

  bakeTexture(scene, TEXTURES.shelves, size, size, (g) => {
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
    g.fillRoundedRect(0, plankY, size, 34, 10);
    g.fillStyle(KITCHEN_COLORS.shelf, 1);
    g.fillRoundedRect(0, plankY, size, 24, 10);
  });

  bakeTexture(scene, TEXTURES.utensils, size, size, (g) => {
    const dark = shade(KITCHEN_COLORS.counter, -0.15);
    g.fillStyle(dark, 0.55);
    g.fillRoundedRect(60, 40, 10, 150, 5);
    g.fillCircle(65, 220, 34);
    g.fillRoundedRect(330, 90, 10, 190, 5);
    g.fillRoundedRect(310, 250, 50, 70, 25);
    g.fillRoundedRect(440, 20, 10, 120, 5);
    g.fillCircle(445, 170, 26);
  });
}

/** Four screen-fixed parallax layers plus a counter that stays with the tray. */
export class Background {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly layers: ParallaxLayer[];
  private skyHeight = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    trayTopY: number,
    width: number,
    height: number,
  ) {
    createTextures(scene);
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.background);
    const keys = [TEXTURES.wallpaper, TEXTURES.tiles, TEXTURES.shelves, TEXTURES.utensils];
    this.layers = keys.map((key, i) => ({
      sprite: scene.add
        .tileSprite(0, 0, width, height, key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(DEPTH.background + 1 + i),
      factor: ANIM.parallax[i] ?? 1,
    }));
    this.drawCounter(trayTopY, width);
    this.resize(width, height);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    for (const layer of this.layers) layer.sprite.setSize(width, height);
    if (height === this.skyHeight) return;
    this.skyHeight = height;
    this.sky.clear();
    for (let i = 0; i < SKY_BANDS; i++) {
      const y0 = Math.floor((height * i) / SKY_BANDS);
      const y1 = Math.ceil((height * (i + 1)) / SKY_BANDS);
      this.sky.fillStyle(
        mixColor(KITCHEN_COLORS.skyTop, KITCHEN_COLORS.skyBottom, i / (SKY_BANDS - 1)),
        1,
      );
      this.sky.fillRect(0, y0, width, y1 - y0);
    }
  }

  update(scrollY: number): void {
    for (const { sprite, factor } of this.layers) sprite.tilePositionY = scrollY * factor;
  }

  private drawCounter(trayTopY: number, width: number): void {
    const top = trayTopY + ANIM.tray.thickness;
    const g = this.scene.add.graphics().setDepth(DEPTH.background + this.layers.length + 1);
    g.fillStyle(KITCHEN_COLORS.counter, 1);
    g.fillRect(0, top, width, COUNTER_DEPTH);
    g.fillStyle(KITCHEN_COLORS.counterTop, 1);
    g.fillRect(0, top, width, COUNTER_TOP_HEIGHT);
    g.fillStyle(shade(KITCHEN_COLORS.counter, -0.2), 1);
    g.fillRect(0, top + COUNTER_TOP_HEIGHT, width, 8);
  }
}

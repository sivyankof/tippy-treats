import type * as Phaser from 'phaser';
import { SHOP_COLORS, SHOP_LOOK, SHOP_TEX, WINDOW_LOOK } from '../../../data/window-look';
import { shade } from '../../../util/color';
import { bakeTexture } from '../../ui/bake-texture';
import { Hover, type FrameCtx, type Life } from './life';
import { circle, ellipse, outlined, roundRect, tint as muteTint } from './art-kit';

type Graphics = Phaser.GameObjects.Graphics;

const D = SHOP_LOOK.display;
const C = SHOP_COLORS;
const GLOSS = 0xffffff;
const GLOSS_ALPHA = 0.5;
const THIN = 1.6;

// Layout of the picture (px): the cap, the glass case with one shelf, the wooden base.
const CAP = { x: 6, y: 3, w: 44, h: 8 };
const CASE = { x: 8, y: 10, w: 40, h: 70 };
const SHELF_Y = 46;
const FLOOR_Y = 77;
const BASE = { x: 5, y: 78, w: 46, h: 22 };
const COLUMNS = [18, 38] as const;

function tint(color: number): number {
  return muteTint(color, D.mute);
}

/** A small round cake: a sponge tier, a glaze cap and a cherry. */
function cake(g: Graphics, x: number, floor: number): void {
  outlined(g, tint(C.sweets.cake), ellipse(g, x, floor - 7, 22, 15), THIN);
  outlined(g, tint(D.cake.glaze), ellipse(g, x, floor - 12, 22, 9), THIN);
  outlined(g, tint(D.cake.cherry), circle(g, x, floor - 18, 3), THIN);
  g.fillStyle(GLOSS, GLOSS_ALPHA);
  g.fillEllipse(x - 5, floor - 13, 6, 2.5);
}

/** A cupcake: a fluted liner under a dome of frosting. */
function cupcake(g: Graphics, x: number, floor: number): void {
  const liner = tint(D.cupcake.liner);
  outlined(g, tint(D.cupcake.frosting), ellipse(g, x, floor - 13, 17, 14), THIN);
  outlined(g, liner, roundRect(g, x - 8, floor - 9, 16, 9, 3), THIN);
  g.fillStyle(shade(liner, -0.15), 1);
  g.fillRect(x - 2, floor - 8, 1.5, 7);
  g.fillRect(x + 3, floor - 8, 1.5, 7);
  g.fillStyle(GLOSS, GLOSS_ALPHA);
  g.fillEllipse(x - 3, floor - 16, 5, 2.5);
}

/** A ring donut with a glaze and a dark hole. */
function donut(g: Graphics, x: number, floor: number): void {
  const dough = tint(D.donut.dough);
  const cy = floor - 9;
  outlined(g, dough, circle(g, x, cy, 10), THIN);
  g.fillStyle(tint(D.donut.icing), 1);
  g.fillCircle(x, cy - 1, 8.5);
  g.fillStyle(shade(dough, -0.35), 1);
  g.fillCircle(x, cy - 1, 3);
  g.fillStyle(GLOSS, GLOSS_ALPHA);
  g.fillRoundedRect(x - 7, cy - 6, 2.5, 6, 1.2);
}

/** A glass jar of candies with a lid. */
function jar(g: Graphics, x: number, floor: number): void {
  outlined(g, tint(D.jar.glass), roundRect(g, x - 8, floor - 15, 16, 15, 5), THIN);
  const [a, b, c] = D.jar.candies;
  g.fillStyle(tint(a), 1);
  g.fillCircle(x - 3.5, floor - 4, 3.6);
  g.fillStyle(tint(b), 1);
  g.fillCircle(x + 3.5, floor - 4, 3.6);
  g.fillStyle(tint(c), 1);
  g.fillCircle(x, floor - 9, 3.6);
  outlined(g, tint(D.cap), roundRect(g, x - 7, floor - 19, 14, 5, 2.5), THIN);
  g.fillStyle(GLOSS, GLOSS_ALPHA);
  g.fillRoundedRect(x - 6, floor - 13, 2, 6, 1);
}

/** The glass-front counter: a pink cap, a case with two shelves of sweets, a wooden base. All muted towards the wall. */
export function bakeDisplay(scene: Phaser.Scene): void {
  bakeTexture(scene, SHOP_TEX.display, D.w * D.unit, D.h * D.unit, (g) => {
    g.scaleCanvas(D.unit, D.unit);
    const wood = tint(D.wood);
    // Case: pale back wall, the sweets, then the glass over them.
    const caseShape = roundRect(g, CASE.x, CASE.y, CASE.w, CASE.h, 5);
    g.fillStyle(D.caseOutline, 1);
    caseShape(THIN);
    g.fillStyle(tint(C.sweets.cream), 1);
    caseShape(0);
    cake(g, COLUMNS[0], SHELF_Y);
    cupcake(g, COLUMNS[1], SHELF_Y);
    donut(g, COLUMNS[0], FLOOR_Y);
    jar(g, COLUMNS[1], FLOOR_Y);
    g.fillStyle(shade(wood, -0.1), 1);
    g.fillRoundedRect(CASE.x, SHELF_Y, CASE.w, 3, 1.5);
    g.fillStyle(tint(D.glass), D.glassAlpha * 0.5);
    g.fillRoundedRect(CASE.x, CASE.y, CASE.w, CASE.h, 5);
    g.fillStyle(GLOSS, 0.4);
    g.fillRoundedRect(CASE.x + 4, CASE.y + 6, 3.5, 30, 1.7);
    g.fillRoundedRect(CASE.x + 4, CASE.y + 39, 3.5, 5, 1.7);
    // Cap and base.
    outlined(g, tint(D.cap), roundRect(g, CAP.x, CAP.y, CAP.w, CAP.h, 4), THIN);
    outlined(g, wood, roundRect(g, BASE.x, BASE.y, BASE.w, BASE.h, 7), THIN);
    g.fillStyle(shade(wood, 0.18), 1);
    g.fillRoundedRect(BASE.x + 5, BASE.y + 7, BASE.w - 10, BASE.h - 12, 5);
    g.fillStyle(GLOSS, 0.35);
    g.fillRoundedRect(BASE.x + 9, BASE.y + 3, 16, 2.5, 1.5);
  });
}

/**
 * Shows the counter only in a run (the menu scenery has no flying-layer band) and only on a screen at least
 * `minHeight` tall: a short screen has no room, so the picture is left out, not shrunk.
 */
class DisplayLife implements Life {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  private shown: boolean | null = null;

  constructor(private readonly hover: Hover) {
    this.objects = hover.objects;
  }

  update(ctx: FrameCtx): void {
    const show = ctx.clearBand !== null && ctx.height >= D.minHeight;
    if (show !== this.shown) {
      this.shown = show;
      for (const image of this.hover.objects) image.setVisible(show);
    }
    if (show) this.hover.update(ctx);
  }
}

/** The counter at the left edge of the run; it breathes with the window and bobs a little. */
export function displayLife(scene: Phaser.Scene): Life {
  return new DisplayLife(
    new Hover(scene, [
      {
        texture: SHOP_TEX.display,
        at: D.at,
        offset: D.offset,
        pulse: WINDOW_LOOK.pulse,
        bob: { px: D.bob.px, ms: D.bob.ms },
      },
    ]),
  );
}

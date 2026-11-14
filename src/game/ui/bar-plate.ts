import type * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { bakeTexture } from './bake-texture';

const PLATE_TEXTURE = 'ui_bar_plate';
const { radius, color, alpha, shadowColor, shadowAlpha, shadowOffset, shadowBlur, shadowSteps } =
  HUD_LAYOUT.barPlate;
/** Space the soft shadow takes around the plate itself. */
const MARGIN = shadowBlur + shadowOffset;
/** The stretchable centre is this wide in the baked picture. */
const CENTRE = 4;
const CORNER = MARGIN + radius;
const TEXTURE_SIZE = CORNER * 2 + CENTRE;

/** Bakes the plate with its soft shadow once: a rounded panel over stacked, growing shadow layers. */
function bakePlate(scene: Phaser.Scene): void {
  bakeTexture(scene, PLATE_TEXTURE, TEXTURE_SIZE, TEXTURE_SIZE, (g) => {
    const inner = TEXTURE_SIZE - MARGIN * 2;
    g.fillStyle(shadowColor, shadowAlpha / shadowSteps);
    for (let i = 0; i < shadowSteps; i++) {
      const grow = (shadowBlur * (shadowSteps - i)) / shadowSteps;
      g.fillRoundedRect(
        MARGIN - grow,
        MARGIN + shadowOffset - grow,
        inner + grow * 2,
        inner + grow * 2,
        radius + grow,
      );
    }
    g.fillStyle(color, alpha).fillRoundedRect(MARGIN, MARGIN, inner, inner, radius);
  });
}

/**
 * A rounded panel with a soft shadow that sits behind the wobble label and gauge so they read on
 * any backdrop. A nine-slice of one baked picture: it is resized to the row, never redrawn.
 */
export class BarPlate {
  readonly image: Phaser.GameObjects.NineSlice;

  constructor(scene: Phaser.Scene) {
    bakePlate(scene);
    this.image = scene.add.nineslice(
      0,
      0,
      PLATE_TEXTURE,
      undefined,
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      CORNER,
      CORNER,
      CORNER,
      CORNER,
    );
  }

  /** Centres the plate on (x, y) so that the panel (not its shadow) is `width` x `height`. */
  place(x: number, y: number, width: number, height: number): void {
    this.image.setPosition(x, y).setSize(width + MARGIN * 2, height + MARGIN * 2);
  }
}

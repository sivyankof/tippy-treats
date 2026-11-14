import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { MS_PER_SECOND } from '../../../util/math';
import { bakeTexture } from '../bake-texture';

const KEY = 'ui_menu_dots';
const { dotStep, dotRadius, dotAlpha, driftPerSecond } = MENU.background;

/** The cream background of the menu screens with soft dots; the dots drift slowly. */
export class MenuBackground {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly dots: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    bakeTexture(scene, KEY, dotStep, dotStep, (g) => {
      g.fillStyle(PALETTE.panelShadow, dotAlpha);
      g.fillCircle(dotStep / 4, dotStep / 4, dotRadius);
      g.fillCircle((dotStep * 3) / 4, (dotStep * 3) / 4, dotRadius);
    });
    this.fill = scene.add.rectangle(0, 0, 1, 1, PALETTE.panel).setOrigin(0);
    this.dots = scene.add.tileSprite(0, 0, 1, 1, KEY).setOrigin(0);
  }

  resize(width: number, height: number): void {
    this.fill.setSize(width, height);
    this.dots.setSize(width, height);
  }

  /** The dots drift diagonally, so the screen is never quite still. */
  update(dtMs: number): void {
    const shift = (dtMs / MS_PER_SECOND) * driftPerSecond;
    this.dots.tilePositionX += shift;
    this.dots.tilePositionY += shift;
  }
}

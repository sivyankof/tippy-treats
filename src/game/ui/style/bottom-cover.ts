import type * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { RefitPlate } from './refit-plate';

const cfg = MENU.header.bottomCover;

/**
 * A bar over the safe band at the bottom of the canvas (the gesture bar) on a screen whose list
 * scrolls: the list stops above the band, and the bar hides what runs under it. A zone over the
 * bar takes the taps there, so a button of the list hidden under it never fires. It reaches the
 * screen edge; without a band it is hidden and takes nothing.
 */
export class BottomCover {
  private readonly bar: RefitPlate;
  private readonly shield: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene) {
    this.bar = new RefitPlate(scene, 'bar', cfg.overhang + 1);
    this.bar.plate.setVisible(false);
    this.shield = scene.add.zone(0, 0, 1, 1).setOrigin(0);
  }

  /** Puts the bar from `safeBottom` (the top of the band) down to the edge of a canvas `height` tall. */
  layout(width: number, height: number, safeBottom: number): void {
    const reach = height - safeBottom;
    const plate = this.bar.setBodyHeight(reach + cfg.overhang);
    plate
      .setBodyWidth(width + cfg.overhang * 2)
      .setPosition(width / 2, safeBottom + (reach + cfg.overhang) / 2)
      .setVisible(reach > 0);
    this.shield.setPosition(0, safeBottom).setSize(width, Math.max(1, reach)).setDepth(plate.depth);
    if (reach > 0) this.shield.setInteractive();
    else this.shield.disableInteractive();
  }
}

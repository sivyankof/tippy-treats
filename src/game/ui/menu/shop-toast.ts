import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { createOutlinedText } from '../common/outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';

const cfg = MENU.shop.toast;

/** A short message on a plate under the header that fades by itself. */
export class Toast {
  readonly root: Phaser.GameObjects.Container;
  private readonly plate: VolumePlate;
  private readonly label: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.plate = new VolumePlate(scene, 'chip', cfg.height, { fill: MENU.style.wallet.fill });
    this.label = createOutlinedText(scene, 0, faceOffsetY('chip'), '', cfg.font);
    this.root = scene.add.container(0, 0, [this.plate, this.label]).setDepth(cfg.depth).setAlpha(0);
  }

  layout(width: number): void {
    this.root.setPosition(width / 2, MENU.header.band.bottom + cfg.belowBand);
  }

  show(text: string): void {
    this.label.setText(text);
    fitText(this.label, cfg.maxWidth - cfg.padX * 2);
    this.plate.setBodyWidth(this.label.displayWidth + cfg.padX * 2);
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(1);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      delay: cfg.showMs,
      duration: cfg.fadeMs,
    });
  }
}

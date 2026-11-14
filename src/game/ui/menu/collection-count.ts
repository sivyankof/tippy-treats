import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { VolumePlate } from '../style/volume';
import { createOutlinedText } from '../outlined-text';

const cfg = MENU.collection;

/** The "owned / total" counter of the collection on a dark plate under the title ribbon. */
export class CollectionCount extends Phaser.GameObjects.Container {
  private readonly plate: VolumePlate;

  constructor(scene: Phaser.Scene, text: string) {
    super(scene, 0, cfg.countY);
    const label = createOutlinedText(scene, 0, 0, text, cfg.countFont, PALETTE.gold);
    const { height, padX, minWidth, fill } = cfg.countPlate;
    this.plate = new VolumePlate(scene, 'chip', height, { fill });
    this.plate.setBodyWidth(Math.max(minWidth, label.width + padX * 2));
    this.add([this.plate, label]);
    scene.add.existing(this);
  }
}

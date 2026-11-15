import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { OVEN } from '../../../data/progression';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { OVEN_PICTURE_HEIGHT } from '../../fx/oven-texture';
import { OvenPicture } from './oven-picture';

const cfg = MENU.results.ovenMark;

/** The note of the results screen: a small oven icon (no face) and "×6 fresh oven" in gold, when the run got fresh layers. */
export class OvenMark extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const label = createOutlinedText(
      scene,
      0,
      0,
      t('oven.mark', { n: OVEN.layersPerXp }),
      cfg.font,
      PALETTE.gold,
    );
    const iconWidth = OVEN_PICTURE_HEIGHT * cfg.iconScale * 1.1;
    const total = iconWidth + cfg.gap + label.width;
    label.setX(total / 2 - label.width / 2);
    const icon = new OvenPicture(scene, -total / 2 + iconWidth / 2, 0, {
      state: 'lit',
      face: false,
    }).setScale(cfg.iconScale);
    this.add([icon, label]);
    scene.add.existing(this);
  }
}

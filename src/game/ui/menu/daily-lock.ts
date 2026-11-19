import type * as Phaser from 'phaser';
import { dailyUnlockLevel } from '../../../core/daily';
import { MENU } from '../../../data/common/menu-layout';
import { t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { drawPadlock } from './padlock';
import type { DailySection } from './daily-section';

const cfg = MENU.daily.lock;

/** The panel shown instead of the attempts and Play before the daily tower opens. */
export class DailyLock implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = cfg.height;

  constructor(scene: Phaser.Scene) {
    const plate = new VolumePlate(scene, 'card', cfg.height, { fill: cfg.fill })
      .setBodyWidth(cfg.width)
      .setY(cfg.height / 2);
    const g = scene.add.graphics();
    drawPadlock(g, 0, cfg.padlockY, cfg.padlockSize);
    const text = fitText(
      createOutlinedText(
        scene,
        0,
        cfg.textY + faceOffsetY('card'),
        t('daily.locked', { n: dailyUnlockLevel() }),
        cfg.font,
        cfg.color,
      ),
      cfg.width - cfg.textPadding * 2,
    );
    this.root = scene.add.container(0, 0, [plate, g, text]);
  }
}

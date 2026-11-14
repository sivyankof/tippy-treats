import type * as Phaser from 'phaser';
import { dailyUnlockLevel } from '../../../core/daily';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import type { DailySection } from './daily-section';

const cfg = MENU.daily.lock;

/** A padlock drawn in code, centred at (x, y), `size` tall. */
function drawPadlock(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const bodyW = size * 0.78;
  const bodyH = size * 0.55;
  const top = y - size / 2 + size * 0.45;
  const shackle = bodyW * 0.3;
  g.lineStyle(size * 0.14, PALETTE.textLight, 1);
  g.beginPath();
  g.moveTo(x - shackle, top + size * 0.1);
  g.lineTo(x - shackle, top);
  g.arc(x, top, shackle, Math.PI, 0);
  g.lineTo(x + shackle, top + size * 0.1);
  g.strokePath();
  g.fillStyle(PALETTE.textDark, 1);
  g.fillRoundedRect(x - bodyW / 2 - 4, top - 2, bodyW + 8, bodyH + 8, size * 0.14);
  g.fillStyle(PALETTE.gold, 1).fillRoundedRect(x - bodyW / 2, top, bodyW, bodyH, size * 0.12);
  g.fillStyle(PALETTE.textDark, 1).fillCircle(x, top + bodyH * 0.4, size * 0.07);
  g.fillRect(x - size * 0.025, top + bodyH * 0.4, size * 0.05, bodyH * 0.3);
}

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

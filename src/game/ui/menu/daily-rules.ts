import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { ZONES } from '../../../data/zones';
import { t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { createCaption, type DailySection } from './daily-section';
import { fitText } from './fit-text';

const cfg = MENU.daily.rules;
const captionHeight = MENU.daily.caption.height;

/** The rule of a zone as an i18n key: Space draws a random one per layer. */
function ruleKey(rule: (typeof ZONES)[number]['rule'], zone: string): string {
  return zone === 'space' ? 'daily.rule.space' : `daily.rule.${rule}`;
}

/** The zones of a tower in order, each a chip with its name and its rule; the same every day. */
export class DailyRules implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height: number;

  constructor(scene: Phaser.Scene) {
    const rows = Math.ceil(ZONES.length / cfg.cols);
    this.height = captionHeight + rows * cfg.chipHeight + (rows - 1) * cfg.gap;
    const chipWidth = (cfg.width - (cfg.cols - 1) * cfg.gap) / cfg.cols;
    const lift = faceOffsetY('chip');
    const parts: Phaser.GameObjects.GameObject[] = [createCaption(scene, t('daily.rules'))];
    ZONES.forEach((zone, i) => {
      const x = -cfg.width / 2 + chipWidth / 2 + (i % cfg.cols) * (chipWidth + cfg.gap);
      const y = captionHeight + Math.floor(i / cfg.cols) * (cfg.chipHeight + cfg.gap);
      const room = chipWidth - cfg.padX * 2;
      parts.push(
        new VolumePlate(scene, 'chip', cfg.chipHeight, { fill: cfg.fills[zone.id] })
          .setBodyWidth(chipWidth)
          .setPosition(x, y + cfg.chipHeight / 2),
        fitText(
          createOutlinedText(
            scene,
            x,
            y + cfg.zoneY + lift,
            t(`zone.${zone.id}.name`),
            cfg.zoneFont,
          ),
          room,
        ),
        fitText(
          createOutlinedText(
            scene,
            x,
            y + cfg.ruleY + lift,
            t(ruleKey(zone.rule, zone.id)),
            cfg.ruleFont,
            cfg.ruleColor,
          ),
          room,
        ),
      );
    });
    this.root = scene.add.container(0, 0, parts);
  }
}

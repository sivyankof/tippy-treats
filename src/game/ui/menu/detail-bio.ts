import * as Phaser from 'phaser';
import type { CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { t } from '../../../i18n';
import { VolumePlate } from '../style/volume';
import { createBodyText } from './detail-info';
import { fitText } from './fit-text';

const cfg = MENU.detail;
const info = cfg.info;

/** The three lines of the funny description (docs/03, "Описания существ"), each with its label. */
export function bioLines(id: CreatureId): string[] {
  return [
    t('detail.bioCharacter', { text: t(`creature.${id}.bio.character`) }),
    t('detail.bioLikes', { text: t(`creature.${id}.bio.likes`) }),
    t('detail.bioDislikes', { text: t(`creature.${id}.bio.dislikes`) }),
  ];
}

/**
 * The speech panel with the description of a creature: a window plate with three lines. Its position is the top centre of the plate. A tap on it closes it (`onClose`).
 */
export class DetailBio extends Phaser.GameObjects.Container {
  readonly bodyHeight: number;

  constructor(scene: Phaser.Scene, id: CreatureId, minHeight: number, onClose: () => void) {
    super(scene, 0, 0);
    const lines = bioLines(id).map((line) =>
      fitText(createBodyText(scene, line, cfg.bio.font, false), info.wrap),
    );
    const lineHeight = Math.max(...lines.map((line) => line.height * line.scaleY));
    const textHeight = lines.length * lineHeight + (lines.length - 1) * cfg.bio.lineGap;
    // The panel covers the whole text block it opens over, so nothing of it peeks out below.
    this.bodyHeight = Math.max(minHeight, textHeight + info.padY * 2);
    const plate = new VolumePlate(scene, 'window', this.bodyHeight).setBodyWidth(info.width);
    plate.setPosition(0, this.bodyHeight / 2);
    this.add(plate);
    const top = (this.bodyHeight - textHeight) / 2 + lineHeight / 2;
    lines.forEach((line, i) => {
      line.setPosition(0, top + i * (lineHeight + cfg.bio.lineGap));
      this.add(line);
    });
    this.setSize(info.width, this.bodyHeight);
    // The hit area is measured from the middle of the container, the plate hangs below it.
    const hit = new Phaser.Geom.Rectangle(0, this.bodyHeight / 2, info.width, this.bodyHeight);
    this.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    this.on(Phaser.Input.Events.POINTER_UP, onClose);
    scene.add.existing(this);
  }
}

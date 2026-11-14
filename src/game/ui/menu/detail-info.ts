import * as Phaser from 'phaser';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { RARITY_COLORS } from '../../../data/rarity';
import { t } from '../../../i18n';
import { createOutlinedText, createStrokedText } from '../outlined-text';
import { VolumePlate, faceOffsetY } from '../style/volume';
import { fitText } from './fit-text';

const cfg = MENU.detail;
const info = cfg.info;

/** A centred body text of the card: dark letters with a light outline, wrapped when `wrap`. */
export function createBodyText(
  scene: Phaser.Scene,
  text: string,
  font: number,
  wrap = true,
): Phaser.GameObjects.Text {
  const line = createStrokedText(
    scene,
    0,
    0,
    text,
    font,
    PALETTE.textDark,
    PALETTE.panel,
    cfg.bodyStroke,
  ).setAlign('center');
  return wrap ? line.setWordWrapWidth(info.wrap) : line;
}

/** A body text on its own window plate; the plate is as high as the text needs. */
export function createTextPlate(
  scene: Phaser.Scene,
  text: string,
  minHeight: number,
): Phaser.GameObjects.Container {
  const label = createBodyText(scene, text, cfg.abilityFont);
  const height = Math.max(minHeight, label.height + info.padY * 2);
  const plate = new VolumePlate(scene, 'window', height).setBodyWidth(info.width);
  label.setY(faceOffsetY('window'));
  return scene.add.container(0, 0, [plate, label]);
}

/**
 * The text block of the card on a window plate: rarity chip, trait, the ability and the green
 * line with what the next level changes. Its position is the top centre of the plate.
 */
export class DetailInfo extends Phaser.GameObjects.Container {
  /** Height of the plate body. */
  readonly bodyHeight: number;

  constructor(scene: Phaser.Scene, id: CreatureId, abilityText: string, nextText: string | null) {
    super(scene, 0, 0);
    const def = CREATURES[id];
    const rarity = createOutlinedText(scene, 0, 0, t(`rarity.${def.rarity}`), info.rarityFont);
    const chipWidth = Math.max(info.chipMinWidth, rarity.width + info.chipPadX * 2);
    const chip = new VolumePlate(scene, 'chip', info.chipHeight, {
      fill: RARITY_COLORS[def.rarity],
    }).setBodyWidth(chipWidth);
    const trait = fitText(createBodyText(scene, t(def.traitKey), cfg.traitFont, false), info.wrap);
    const ability = createBodyText(scene, abilityText, cfg.abilityFont).setOrigin(0.5, 0);
    const next = nextText
      ? createOutlinedText(scene, 0, 0, nextText, cfg.abilityFont, PALETTE.success)
          .setOrigin(0.5, 0)
          .setWordWrapWidth(info.wrap)
          .setAlign('center')
      : null;

    let y = info.padY;
    chip.setPosition(0, y + info.chipHeight / 2);
    rarity.setPosition(0, chip.y + faceOffsetY('chip'));
    y += info.chipHeight + info.gap;
    trait.setPosition(0, y + trait.height / 2);
    y += trait.height + info.gap;
    ability.setY(y);
    y += ability.height;
    if (next) {
      y += info.nextGap;
      next.setY(y);
      y += next.height;
    }
    this.bodyHeight = Math.max(info.minHeight, y + info.padY);
    const plate = new VolumePlate(scene, 'window', this.bodyHeight).setBodyWidth(info.width);
    plate.setPosition(0, this.bodyHeight / 2);
    this.add([plate, chip, rarity, trait, ability]);
    if (next) this.add(next);
    scene.add.existing(this);
  }
}

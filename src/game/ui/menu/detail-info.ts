import * as Phaser from 'phaser';
import { CREATURES, type CreatureId } from '../../../data/creatures/creatures';
import { MENU } from '../../../data/common/menu-layout';
import { MASTERY_FRAME } from '../../../data/creatures/mastery-look';
import { PALETTE } from '../../../data/common/palette';
import { parseHex } from '../../../util/color';
import { RARITY_COLORS } from '../../../data/creatures/rarity';
import { t } from '../../../i18n';
import { createOutlinedText, createStrokedText } from '../outlined-text';
import { VolumePlate, faceOffsetY } from '../style/volume';
import { FX_TEXTURES } from '../../fx/common/fx-textures';
import { fitText } from './fit-text';
import type { DetailRow } from './detail-rows';

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

/** What the text block shows: the ability, the master lines of a level 5 creature, the next level rows. */
export interface InfoContent {
  abilityText: string;
  /** Under the ability, gold: the master effect of a creature that already has it. */
  master: DetailRow[];
  /** "What the next level gives"; empty at the maximum level and for a locked creature. */
  next: DetailRow[];
  /** The trait line under the rarity chip (left out on a short screen). */
  trait: boolean;
}

const GOLD = parseHex(MASTERY_FRAME.gold);

/** One row of the block as a centred text, with the small gold star in front of the new look. */
function createRow(scene: Phaser.Scene, row: DetailRow): Phaser.GameObjects.Container {
  const color = row.kind === 'change' || row.kind === 'perk' ? PALETTE.success : GOLD;
  const text =
    row.kind === 'phrase'
      ? createBodyText(scene, row.text, cfg.phraseFont).setOrigin(0.5, 0)
      : createOutlinedText(scene, 0, 0, row.text, cfg.abilityFont, color)
          .setOrigin(0.5, 0)
          .setWordWrapWidth(info.wrap)
          .setAlign('center');
  const group = scene.add.container(0, 0, [text]);
  if (row.kind === 'look') {
    const star = scene.add
      .image(0, text.height / 2, FX_TEXTURES.star)
      .setTint(GOLD)
      .setScale(info.starScale);
    text.x = star.displayWidth / 2 + info.starGap / 2;
    star.x = text.x - text.width / 2 - info.starGap - star.displayWidth / 2;
    group.add(star);
  }
  group.setSize(text.width, text.height);
  return group;
}

/**
 * The text block of the card on a window plate: rarity chip, trait, the ability, the master lines
 * of a level 5 creature and the rows of what the next level gives. Its position is the top centre
 * of the plate.
 */
export class DetailInfo extends Phaser.GameObjects.Container {
  /** Height of the plate body. */
  readonly bodyHeight: number;

  constructor(scene: Phaser.Scene, id: CreatureId, content: InfoContent) {
    super(scene, 0, 0);
    const def = CREATURES[id];
    const rarity = createOutlinedText(scene, 0, 0, t(`rarity.${def.rarity}`), info.rarityFont);
    const chipWidth = Math.max(info.chipMinWidth, rarity.width + info.chipPadX * 2);
    const chip = new VolumePlate(scene, 'chip', info.chipHeight, {
      fill: RARITY_COLORS[def.rarity],
    }).setBodyWidth(chipWidth);
    const trait = content.trait
      ? fitText(createBodyText(scene, t(def.traitKey), cfg.traitFont, false), info.wrap)
      : null;
    const ability = createBodyText(scene, content.abilityText, cfg.abilityFont).setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];

    let y = info.padY;
    chip.setPosition(0, y + info.chipHeight / 2);
    rarity.setPosition(0, chip.y + faceOffsetY('chip'));
    y += info.chipHeight + info.gap;
    if (trait) {
      trait.setPosition(0, y + trait.height / 2);
      y += trait.height + info.gap;
      parts.push(trait);
    }
    ability.setY(y);
    y += ability.height;
    const stack = (rows: DetailRow[]): void => {
      if (rows.length === 0) return;
      y += info.nextGap;
      for (const row of rows) {
        const item = createRow(scene, row);
        item.setY(y);
        y += item.height + info.rowGap;
        parts.push(item);
      }
      y -= info.rowGap;
    };
    stack(content.master);
    stack(content.next);
    this.bodyHeight = Math.max(info.minHeight, y + info.padY);
    const plate = new VolumePlate(scene, 'window', this.bodyHeight).setBodyWidth(info.width);
    plate.setPosition(0, this.bodyHeight / 2);
    this.add([plate, chip, rarity, ability, ...parts]);
    scene.add.existing(this);
  }
}

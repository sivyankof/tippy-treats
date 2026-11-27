import type * as Phaser from 'phaser';
import type { JournalCounts } from '../../../../core/progression/journal';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { JOURNAL_ART } from '../../../../data/progression/journal-art';
import {
  JOURNAL_CHEVRON_KEY,
  bakeJournalDish,
  bakeJournalIcons,
  journalDishKey,
  journalIconKey,
  type JournalIconId,
} from '../../../fx/journal/journal-textures';
import { ProgressBar } from '../widgets/progress-bar';
import { journalBarText, journalPlace, type JournalCounter } from './journal-text';

/** The icon of the fly bar or of a row, its drawing `size` wide; it is baked here if it is missing. */
export function createJournalIcon(
  scene: Phaser.Scene,
  id: JournalIconId,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image {
  bakeJournalIcons(scene);
  return scene.add.image(x, y, journalIconKey(id)).setScale(size / JOURNAL_ART.iconSize);
}

/** The picture of a dish, its drawing `size` wide. */
export function createJournalDish(
  scene: Phaser.Scene,
  index: number,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image {
  bakeJournalDish(scene, index);
  return scene.add.image(x, y, journalDishKey(index)).setScale(size / JOURNAL_ART.dishSize);
}

/** The arrow at the right end of a tappable plate. */
export function createChevron(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  bakeJournalIcons(scene);
  return scene.add
    .image(x, y, JOURNAL_CHEVRON_KEY)
    .setScale(MENU.journal.chevron / JOURNAL_ART.chevronSize);
}

/** The bar of a counter: filled to the share of its tier, with "312 / 500" (or the top tier) on it. */
export function createTierBar(
  scene: Phaser.Scene,
  id: JournalCounter,
  counts: JournalCounts,
  size: { x: number; y: number; width: number; height: number; font: number },
): ProgressBar {
  return new ProgressBar(scene, size.x, size.y, size.width, size.height, size.font, PALETTE.gold)
    .setShare(journalPlace(id, counts).share)
    .setLabel(journalBarText(id, counts));
}

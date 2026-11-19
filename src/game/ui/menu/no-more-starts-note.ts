import type * as Phaser from 'phaser';
import { CHECKPOINT_WINDOW } from '../../../data/zones/checkpoint-look';
import { t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';

/**
 * The small caption that takes the place of the ad button of a start from a checkpoint once
 * today's ad starts are used up ("No more ad starts today").
 */
export function createAdsSpentNote(
  scene: Phaser.Scene,
  x: number,
  y: number,
  maxWidth: number,
): Phaser.GameObjects.Text {
  const note = createOutlinedText(
    scene,
    x,
    y,
    t('checkpoint.adsSpent'),
    CHECKPOINT_WINDOW.noteFont,
  );
  return fitText(note, maxWidth);
}

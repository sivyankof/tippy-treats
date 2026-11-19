import type * as Phaser from 'phaser';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createTextButton, type Button, type LabelButtonLayout } from '../../common/button';

/** The small "Choose start" button that opens the "Where from?" window (Home and the results). */
export function createStartFromButton(
  scene: Phaser.Scene,
  layout: LabelButtonLayout & { font: number; pad: number },
  keyPrefix: string,
  onClick: () => void,
): Button {
  return createTextButton(scene, {
    text: t('checkpoint.from'),
    font: layout.font,
    maxLabelWidth: layout.width - layout.pad,
    fill: PALETTE.accentSecondary,
    layout,
    keyPrefix,
    onClick,
  }).button;
}

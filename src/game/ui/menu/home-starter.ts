import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../button';

const cfg = MENU.home.starter;

/** The gold starter pack button of Home; `price` is the store's price text. */
export function createStarterButton(
  scene: Phaser.Scene,
  price: string,
  onClick: () => void,
): Button {
  const { width, height, radius, shadowOffset, font, pad } = cfg;
  return createTextButton(scene, {
    text: t('home.starter', { price }),
    font,
    maxLabelWidth: width - pad,
    fill: PALETTE.gold,
    layout: { width, height, radius, shadowOffset },
    keyPrefix: 'ui_home_starter',
    onClick,
  }).button.breathe(false);
}

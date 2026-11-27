import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { createTextButton, type Button } from '../../common/button';

const cfg = MENU.settings;

/** A full-width button of the link style (height, font and fill of the site links) with its top edge at `top`. */
export function createLinkButton(
  scene: Phaser.Scene,
  label: string,
  width: number,
  top: number,
  onClick: () => void,
): Button {
  const { height, radius, shadowOffset, font, fill } = cfg.links;
  return createTextButton(scene, {
    text: label,
    font,
    maxLabelWidth: width - radius * 2,
    fill,
    layout: { width, height, radius, shadowOffset },
    keyPrefix: 'ui_settings_link_wide',
    y: top + height / 2,
    onClick,
  }).button;
}

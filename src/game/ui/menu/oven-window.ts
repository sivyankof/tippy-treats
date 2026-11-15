import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { OVEN } from '../../../data/progression';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { gameState } from '../../../state';
import { createTextButton } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/dialog-window';
import { OvenPicture } from './oven-picture';

const cfg = MENU.ovenWindow;

/**
 * The explainer of the fresh oven: a big lit oven and one line, the first layers of each day give
 * several times more XP. It opens once by itself (hint `oven`) and again on a tap on the plate.
 */
export function openOvenWindow(scene: Phaser.Scene, onClosed?: () => void): PopupWindow {
  gameState.markHint('oven');
  const popup = new PopupWindow(scene, {
    title: t('oven.title'),
    contentHeight: cfg.contentHeight,
    onClosed,
  });
  popup.content.add(
    new OvenPicture(scene, 0, cfg.pictureY, { state: 'lit', face: true }).setScale(
      cfg.pictureScale,
    ),
  );
  const line = createOutlinedText(
    scene,
    0,
    cfg.textY,
    t('oven.explain', { n: formatNumber(OVEN.freshLayers), x: OVEN.layersPerXp }),
    cfg.font,
    PALETTE.textLight,
  );
  line.setWordWrapWidth(popup.innerWidth, true).setAlign('center');
  popup.content.add(line);
  const ok = createTextButton(scene, {
    text: t('oven.ok'),
    font: cfg.button.font,
    maxLabelWidth: cfg.button.width - cfg.button.radius * 2,
    fill: PALETTE.accent,
    layout: cfg.button,
    keyPrefix: 'ui_oven_ok',
    x: 0,
    y: cfg.buttonY,
    onClick: popup.close,
  });
  popup.content.add(ok.button);
  return popup;
}

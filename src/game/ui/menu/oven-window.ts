import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { OVEN } from '../../../data/progression';
import { formatNumber, t } from '../../../i18n';
import { gameState } from '../../../state';
import type { PopupWindow } from '../style/dialog-window';
import { openExplainerWindow } from './explainer-window';
import { OvenPicture } from './oven-picture';

const cfg = MENU.ovenWindow;

/**
 * The explainer of the fresh oven: a big lit oven and one line, the first layers of each day give
 * several times more XP. It opens once by itself (hint `oven`) and again on a tap on the plate.
 */
export function openOvenWindow(scene: Phaser.Scene, onClosed?: () => void): PopupWindow {
  gameState.markHint('oven');
  return openExplainerWindow(scene, {
    title: t('oven.title'),
    picture: new OvenPicture(scene, 0, 0, { state: 'lit', face: true }).setScale(cfg.pictureScale),
    text: t('oven.explain', { n: formatNumber(OVEN.freshLayers), x: OVEN.layersPerXp }),
    layout: cfg,
    keyPrefix: 'ui_oven_ok',
    onClosed,
  });
}

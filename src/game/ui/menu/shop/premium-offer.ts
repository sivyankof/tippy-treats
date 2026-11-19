import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { effectsMode } from '../../../app/effects-mode';
import { createTextButton } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { buyProduct } from '../../../economy/purchases';
import { createBodyText } from '../detail/detail-info';
import { fitText } from '../widgets/fit-text';
import { createNoAdsIcon } from './shop-premium-icon';

const cfg = MENU.noAdsOffer;

/**
 * The gentle "No ads for {price}" window. Buying goes through the purchases service; "Not now"
 * and the close button just close it. `onClosed` runs once it is gone, however it ended.
 */
export function openNoAdsOffer(scene: Phaser.Scene, price: string, onClosed: () => void): void {
  const popup = new PopupWindow(scene, {
    title: t('noAdsOffer.title'),
    contentHeight: cfg.contentHeight,
    onClosed,
  });
  const icon = createNoAdsIcon(scene, cfg.iconSize).setPosition(0, cfg.iconY);
  popup.content.add(icon);
  if (!effectsMode.reduced) {
    scene.tweens.add({
      targets: icon,
      angle: { from: -cfg.sway.angle, to: cfg.sway.angle },
      duration: cfg.sway.ms,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }
  // The same dark body text as the shop card, so the long line reads on the light window.
  const text = createBodyText(scene, t('shop.noAds.desc'), cfg.textFont, true)
    .setPosition(0, cfg.textY)
    .setWordWrapWidth(popup.innerWidth);
  const note = createOutlinedText(scene, 0, cfg.noteY, '', cfg.noteFont);
  popup.content.add([text, note]);

  let busy = false;
  const { button: buy } = createTextButton(scene, {
    text: t('noAdsOffer.buy', { price }),
    font: cfg.buy.font,
    maxLabelWidth: cfg.buy.width - cfg.buy.radius * 2,
    fill: PALETTE.accent,
    layout: cfg.buy,
    keyPrefix: 'ui_no_ads_buy',
    x: 0,
    y: cfg.buyY,
    onClick: () => {
      if (busy) return;
      busy = true;
      buy.setEnabled(false);
      void buyProduct('remove_ads').then((outcome) => {
        if (!popup.content.active) return;
        if (outcome === 'purchased') {
          popup.close();
          return;
        }
        busy = false;
        buy.setEnabled(true);
        if (outcome !== 'cancelled') {
          note.setText(t(outcome === 'pending' ? 'shop.pending' : 'shop.failed'));
          fitText(note, popup.innerWidth);
        }
      });
    },
  });
  buy.breathe(false);
  const { button: later } = createTextButton(scene, {
    text: t('noAdsOffer.later'),
    font: MENU.smallButton.font,
    maxLabelWidth: MENU.smallButton.width - MENU.smallButton.radius * 2,
    fill: PALETTE.accentSecondary,
    layout: MENU.smallButton,
    keyPrefix: 'ui_no_ads_later',
    x: 0,
    y: cfg.laterY,
    onClick: popup.close,
  });
  popup.content.add([buy, later]);
}

import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createTextButton } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';

const cfg = MENU.consent;

/**
 * Our own window before the system tracking question: why the game asks, then one "Continue"
 * button (no close button: the question must not be skipped by a stray tap). `onContinue` runs
 * once the window has started to close.
 */
export function openConsentExplainer(scene: Phaser.Scene, onContinue: () => void): PopupWindow {
  const popup = new PopupWindow(scene, { title: t('consent.title'), closable: false });
  const text = createOutlinedText(scene, 0, 0, t('consent.text'), cfg.textFont)
    .setOrigin(0.5, 0)
    .setAlign('center')
    .setLineSpacing(cfg.lineSpacing)
    .setWordWrapWidth(popup.innerWidth, true);
  const buttonY = text.height + cfg.textGap + cfg.button.height / 2;
  const button = createTextButton(scene, {
    text: t('consent.continue'),
    font: cfg.button.font,
    maxLabelWidth: cfg.button.width - cfg.button.radius * 2,
    fill: PALETTE.accent,
    layout: cfg.button,
    keyPrefix: 'ui_consent_continue',
    y: buttonY,
    onClick: () => {
      button.button.setEnabled(false);
      popup.close();
      onContinue();
    },
  });
  popup.content.add([text, button.button]);
  popup.setContentHeight(buttonY + cfg.button.height / 2);
  return popup;
}

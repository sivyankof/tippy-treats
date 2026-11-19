import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { STREAK } from '../../../../data/progression/streak';
import { t, tn } from '../../../../i18n';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import { showRewarded } from '../../../rewarded';
import { markAdUnavailable, resetAdLabel } from '../widgets/ad-unavailable';
import { createTextButton, type Button } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { BalanceChip, followBalance } from '../../style/balance-chip';
import { PopupWindow } from '../../style/dialog-window';
import { createPriceButton } from '../../style/price-button';
import { fitText } from '../widgets/fit-text';
import { FlameIcon } from '../widgets/flame-icon';

const cfg = MENU.streak.threat;

/**
 * The streak is about to break: it can be saved for a rewarded ad or for berries, or given up.
 * The window cannot be closed any other way, so the streak is always settled when it is gone.
 */
export function openStreakThreat(scene: Phaser.Scene, onClosed?: () => void): void {
  const popup = new PopupWindow(scene, {
    title: t('streakThreat.title'),
    closable: false,
    onClosed,
  });
  const { content } = popup;
  const streak = gameState.data.streak.count;
  let y = cfg.flame / 2;
  content.add(new FlameIcon(scene, 0, y, cfg.flame));
  y += cfg.flame / 2 + cfg.textGap;

  const text = createOutlinedText(scene, 0, 0, tn('streakThreat.text', streak), cfg.textFont)
    .setWordWrapWidth(popup.innerWidth)
    .setAlign('center');
  text.setY(y + text.height / 2);
  content.add(text);
  y += text.height + cfg.textGap;

  const buttonLayout = {
    width: cfg.buttonWidth,
    height: cfg.buttonHeight,
    radius: cfg.buttonRadius,
    shadowOffset: cfg.buttonShadow,
  };
  const place = (button: Button): Button => {
    button.setY(y + cfg.buttonHeight / 2);
    content.add(button);
    y += cfg.buttonHeight + cfg.buttonGap;
    return button;
  };
  const make = (label: string, fill: number, key: string, onClick: () => void) => {
    const made = createTextButton(scene, {
      text: label,
      font: cfg.buttonFont,
      maxLabelWidth: cfg.buttonWidth - cfg.buttonRadius * 2,
      fill,
      layout: buttonLayout,
      keyPrefix: key,
      onClick,
    });
    place(made.button);
    return made;
  };

  // The balance sits above the buttons: the player sees what they have and what is missing.
  const balance = new BalanceChip(scene, 'berries', cfg.balanceRight, y + cfg.balanceHeight / 2);
  content.add(balance.root);
  y += cfg.balanceHeight + cfg.buttonGap;
  followBalance(scene, balance, content, () => gameState.berries);

  let busy = false;
  const settle = (): void => popup.close();
  const ad = make(t('streakThreat.restoreAd'), PALETTE.accentSecondary, 'ui_threat_ad', () => {
    void watchAd();
  });
  const markAdGone = (): void =>
    markAdUnavailable(
      ad.button,
      ad.label,
      cfg.buttonWidth - cfg.buttonRadius * 2,
      cfg.disabledAlpha,
    );
  const watchAd = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    ad.button.setEnabled(false);
    const result = await showRewarded('streak_restore');
    if (result === 'rewarded' && gameState.restoreStreak('ad')) {
      settle();
      return;
    }
    if (result === 'unavailable') {
      markAdGone();
      busy = false;
      return;
    }
    busy = false;
    ad.button.setEnabled(true);
  };

  if (!services.ads.isRewardedReady()) markAdGone();
  else resetAdLabel(ad.label, cfg.buttonWidth - cfg.buttonRadius * 2);

  place(
    createPriceButton(scene, {
      template: tn('streakThreat.restoreBerries', STREAK.restoreBerries, { price: '{price}' }),
      price: STREAK.restoreBerries,
      have: gameState.berries,
      currency: 'berries',
      fill: PALETTE.accent,
      layout: buttonLayout,
      font: cfg.buttonFont,
      maxWidth: cfg.buttonWidth - cfg.buttonRadius * 2,
      keyPrefix: 'ui_threat_berries',
      onPay: () => {
        if (!busy && gameState.restoreStreak('berries')) settle();
      },
      // The tap takes nothing; the counter shakes.
      onShort: () => balance.shake(),
    }),
  );

  const decline = createOutlinedText(
    scene,
    0,
    y + cfg.declineFont / 2,
    t('streakThreat.decline'),
    cfg.declineFont,
    PALETTE.panelShadow,
  );
  fitText(decline, popup.innerWidth);
  const declineHit = scene.add
    .zone(0, decline.y, popup.innerWidth, cfg.declineHit)
    .setInteractive();
  declineHit.on(Phaser.Input.Events.POINTER_UP, () => {
    if (busy) return;
    busy = true;
    gameState.declineStreak();
    settle();
  });
  content.add([decline, declineHit]);
  popup.setContentHeight(Math.max(y + cfg.declineFont, decline.y + cfg.declineHit / 2));
}

import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { STREAK } from '../../../data/streak';
import { formatNumber, t, tn } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import { createTextButton } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/popup-window';
import { fitText } from './fit-text';
import { FlameIcon } from './flame-icon';

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
  const make = (label: string, fill: number, key: string, onClick: () => void) => {
    const made = createTextButton(scene, {
      text: label,
      font: cfg.buttonFont,
      maxLabelWidth: cfg.buttonWidth - cfg.buttonRadius * 2,
      fill,
      layout: buttonLayout,
      keyPrefix: key,
      x: 0,
      y: y + cfg.buttonHeight / 2,
      onClick,
    });
    content.add(made.button);
    y += cfg.buttonHeight + cfg.buttonGap;
    return made;
  };

  let busy = false;
  const settle = (): void => popup.close();
  const ad = make(t('streakThreat.restoreAd'), PALETTE.accentSecondary, 'ui_threat_ad', () => {
    void watchAd();
  });
  const markAdUnavailable = (): void => {
    ad.label.setText(t('continue.adUnavailable'));
    fitText(ad.label, cfg.buttonWidth - cfg.buttonRadius * 2);
    ad.button.setEnabled(false);
    ad.button.setAlpha(cfg.disabledAlpha);
  };
  const watchAd = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    ad.button.setEnabled(false);
    const result = await services.ads.showRewarded('streak_restore');
    if (result === 'rewarded' && gameState.restoreStreak('ad')) {
      settle();
      return;
    }
    if (result === 'unavailable') {
      markAdUnavailable();
      busy = false;
      return;
    }
    busy = false;
    ad.button.setEnabled(true);
  };

  if (!services.ads.isRewardedReady()) markAdUnavailable();

  const missing = STREAK.restoreBerries - gameState.berries;
  const short = missing > 0;
  const berries = make(
    short
      ? t('streakThreat.restoreShort', { n: formatNumber(missing) })
      : tn('streakThreat.restoreBerries', STREAK.restoreBerries, {
          price: formatNumber(STREAK.restoreBerries),
        }),
    short ? cfg.shortFill : PALETTE.accent,
    short ? 'ui_threat_short' : 'ui_threat_berries',
    () => {
      if (!busy && gameState.restoreStreak('berries')) settle();
    },
  );
  if (short) berries.button.setEnabled(false);

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

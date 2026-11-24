import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t, tn } from '../../../../i18n';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import { logGiftOpen } from '../../../economy/economy-telemetry';
import { showRewarded } from '../../../economy/rewarded';
import {
  followAdButton,
  markAdUnavailable,
  plainAdLabel,
  resetAdLabel,
} from '../widgets/ad-unavailable';
import { cssColor } from '../../../../util/color';
import { createTextButton, type Button } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { fitText } from '../widgets/fit-text';
import { GiftBox } from '../new-creature/new-creature-box';
import { shakeAngle } from '../new-creature/new-creature-reveal';
import { flyReward, type WalletTargets } from '../widgets/reward-flight';
import { formatTimeLeft } from '../widgets/time-text';

const cfg = MENU.gift;

/**
 * The free gift box. Ready: tap "Open", the box shakes, the lid flies off, the coins fly into the
 * wallet and "x2 for an ad" doubles them. Not ready: the time left, which turns into "Open" by itself.
 */
export function openGiftWindow(
  scene: Phaser.Scene,
  onClosed?: () => void,
  wallet?: WalletTargets,
): void {
  const popup = new PopupWindow(scene, {
    title: t('gift.title'),
    contentHeight: cfg.contentHeight,
    onClosed,
  });
  let shake: Phaser.Tweens.Tween | null = null;
  // The gift counts as opened once, when its window is gone and the player has had the chance to double it.
  let opened = false;
  let doubledByAd = false;
  popup.content.once('destroy', () => {
    shake?.stop();
    if (opened) logGiftOpen(doubledByAd);
  });
  const box = new GiftBox(scene, 0, cfg.boxY, { face: true }).setScale(cfg.boxScale);
  box.startSway(cfg.motion, false);
  popup.content.add(box);
  const wait = createOutlinedText(scene, 0, cfg.textY, '', cfg.textFont);
  popup.content.add(wait);

  const addButton = (label: string, fill: number, key: string, onClick: () => void) => {
    const made = createTextButton(scene, {
      text: label,
      font: cfg.button.font,
      maxLabelWidth: cfg.button.width - cfg.button.radius * 2,
      fill,
      layout: cfg.button,
      keyPrefix: key,
      x: 0,
      y: cfg.buttonY,
      onClick,
    });
    popup.content.add(made.button);
    return made;
  };

  const showTimer = (): void => {
    const tick = (): void => {
      if (!wait.active) {
        timer.remove(false);
        return;
      }
      if (gameState.giftReady) {
        timer.remove(false);
        showOpen();
        return;
      }
      wait.setText(t('gift.nextIn', { time: formatTimeLeft(gameState.msUntilGift) }));
      fitText(wait, popup.innerWidth);
    };
    const timer = scene.time.addEvent({ delay: cfg.tickMs, loop: true, callback: tick });
    tick();
  };

  const showOpen = (): void => {
    box.startSway(cfg.motion, true);
    const invite = scene.time.addEvent({
      delay: cfg.motion.hop.everyMs,
      loop: true,
      callback: () => (box.active ? box.hop(cfg.motion) : invite.remove(false)),
    });
    wait.setText(t('gift.ready'));
    fitText(wait, popup.innerWidth);
    const open = addButton(t('gift.open'), PALETTE.accent, 'ui_gift_open', () => {
      open.button.destroy();
      invite.remove(false);
      box.stopSway();
      shakeThenOpen();
    });
    open.button.breathe(false);
  };

  const shakeThenOpen = (): void => {
    services.haptics.play('light');
    const wave = { p: 0 };
    shake = scene.tweens.add({
      targets: wave,
      p: 1,
      duration: cfg.shakeMs,
      ease: 'Quad.easeIn',
      onUpdate: () => box.setAngle(shakeAngle(wave.p, cfg.shakeWaves, cfg.shakeDeg)),
      onComplete: () => reveal(),
    });
  };

  const reveal = (): void => {
    if (!box.active) return;
    box.setAngle(0);
    const coins = gameState.openGift();
    if (coins === null) {
      popup.close();
      return;
    }
    opened = true;
    services.audio.coin();
    services.haptics.play('heavy');
    box.popLid();
    box.startSway(cfg.motion, false);
    // The coins start at the opening, the top of the body, and pour out of it.
    const m = box.getWorldTransformMatrix();
    flyReward(scene, {
      currency: 'coins',
      amount: coins,
      from: { x: m.tx, y: m.ty + box.openingY * m.d },
      wallet,
      pour: true,
    });
    wait
      .setText(tn('gift.coins', coins, { amount: formatNumber(coins) }))
      .setFontSize(cfg.coinsFont);
    wait.setColor(cssColor(PALETTE.gold)).setY(cfg.coinsY).setScale(0);
    fitText(wait, popup.innerWidth);
    const rest = wait.scale;
    wait.setScale(0);
    scene.tweens.add({ targets: wait, scale: rest, duration: cfg.pop.ms, ease: 'Back.easeOut' });
    offerDouble(coins);
  };

  const offerDouble = (coins: number): void => {
    const adLabelWidth = cfg.button.width - cfg.button.radius * 2;
    const markAdGone = (button: Button, label: Phaser.GameObjects.Text): void =>
      markAdUnavailable(button, label, adLabelWidth, cfg.adDisabledAlpha);
    let busy = false;
    let doubled: ReturnType<typeof addButton> | null = null;
    const watch = async (button: Button, label: Phaser.GameObjects.Text): Promise<void> => {
      if (busy) return;
      busy = true;
      button.setEnabled(false);
      const result = await showRewarded('gift_double');
      if (!button.active) return;
      if (result === 'rewarded') {
        gameState.addCoins(coins, 'gift_double');
        doubledByAd = true;
        const m = button.getWorldTransformMatrix();
        flyReward(scene, { currency: 'coins', amount: coins, from: { x: m.tx, y: m.ty }, wallet });
        label.setText(t('gift.doubled'));
        plainAdLabel(label, adLabelWidth);
        return;
      }
      if (result === 'unavailable') {
        markAdGone(button, label);
        busy = false;
      } else {
        busy = false;
        button.setEnabled(true);
      }
    };
    scene.time.delayedCall(cfg.pop.ms, () => {
      if (!wait.active) return;
      doubled = addButton(t('gift.double'), PALETTE.accentSecondary, 'ui_gift_double', () => {
        if (doubled) void watch(doubled.button, doubled.label);
      });
      if (!services.ads.isRewardedReady()) markAdGone(doubled.button, doubled.label);
      else resetAdLabel(doubled.label, adLabelWidth);
      followAdButton(doubled.button, doubled.label, {
        text: t('gift.double'),
        maxWidth: adLabelWidth,
        alpha: cfg.adDisabledAlpha,
        paused: () => busy,
      });
    });
  };

  if (gameState.giftReady) showOpen();
  else showTimer();
}

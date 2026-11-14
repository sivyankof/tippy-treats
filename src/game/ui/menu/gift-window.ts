import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t, tn } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import { cssColor } from '../../../util/color';
import { createTextButton, type Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/popup-window';
import { fitText } from './fit-text';
import { GiftBox } from './new-creature-box';
import { shakeAngle } from './new-creature-reveal';
import { flyReward, type WalletTargets } from './reward-flight';
import { formatTimeLeft } from './time-text';

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
  popup.content.once('destroy', () => shake?.stop());
  const box = new GiftBox(scene, 0, cfg.boxY).setScale(cfg.boxScale);
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
    const idle = scene.tweens.add({
      targets: box,
      angle: { from: -cfg.shakeDeg / 2, to: cfg.shakeDeg / 2 },
      duration: cfg.shakeMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    wait.setText(t('gift.ready'));
    fitText(wait, popup.innerWidth);
    const open = addButton(t('gift.open'), PALETTE.accent, 'ui_gift_open', () => {
      open.button.destroy();
      idle.stop();
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
    services.audio.coin();
    services.haptics.play('heavy');
    box.popLid();
    const m = box.getWorldTransformMatrix();
    flyReward(scene, { currency: 'coins', amount: coins, from: { x: m.tx, y: m.ty }, wallet });
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
    let busy = false;
    let doubled: ReturnType<typeof addButton> | null = null;
    const watch = async (button: Button, label: Phaser.GameObjects.Text): Promise<void> => {
      if (busy) return;
      busy = true;
      button.setEnabled(false);
      const result = await services.ads.showRewarded('gift_double');
      if (!button.active) return;
      if (result === 'rewarded') {
        gameState.addCoins(coins);
        gameState.countAdWatched();
        const m = button.getWorldTransformMatrix();
        flyReward(scene, { currency: 'coins', amount: coins, from: { x: m.tx, y: m.ty }, wallet });
        label.setText(t('gift.doubled'));
        return;
      }
      if (result === 'unavailable') label.setText(t('continue.adUnavailable'));
      else {
        busy = false;
        button.setEnabled(true);
      }
      fitText(label, cfg.button.width - cfg.button.radius * 2);
    };
    scene.time.delayedCall(cfg.pop.ms, () => {
      if (!wait.active) return;
      doubled = addButton(t('gift.double'), PALETTE.accentSecondary, 'ui_gift_double', () => {
        if (doubled) void watch(doubled.button, doubled.label);
      });
    });
  };

  if (gameState.giftReady) showOpen();
  else showTimer();
}

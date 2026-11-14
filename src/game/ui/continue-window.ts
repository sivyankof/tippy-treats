import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { cssColor } from '../../util/color';
import { services } from '../../services';
import type { ContinueFlow } from '../continue-flow';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { createTreasureTextures, TREASURE_TEXTURES } from '../fx/treasure-textures';
import { bakeTexture } from './bake-texture';
import { Button, createLabelButton } from './button';
import { createOutlinedText } from './outlined-text';
import type { UiRegion } from './ui-regions';

const { window: win, timer, button: btn, decline } = CONTINUE_ANIM;
const PANEL_TEXTURE = 'ui_continue_panel';
const DEPTH = 400;
const BERRY_BUTTON_TEXTURE = 'ui_continue_berry_button';
const TITLE_PULSE = { scale: 1.05, ms: 1100 };
const FULL_TURN = Math.PI * 2;
const START_ANGLE = -Math.PI / 2;

/**
 * The "Continue?" window: slides in from the bottom, shows the tower height, a ring timer
 * and the ways to go on. It only draws what the `ContinueFlow` says and passes taps to it.
 */
export class ContinueWindow {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly bob: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly heightText: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly digit: Phaser.GameObjects.Text;
  private readonly adButton: Button;
  private readonly adLabel: Phaser.GameObjects.Text;
  private readonly berryButton: Button;
  private readonly berryLabel: Phaser.GameObjects.Text;
  private readonly declineText: Phaser.GameObjects.Text;
  private flow: ContinueFlow | null = null;
  private shown = false;
  private declineShown = false;
  /** Last enabled state given to a button: `setEnabled` resets a press, so only changes are passed on. */
  private readonly enabledNow = new Map<Button, boolean>();
  private lastDigit = -1;
  private screenH = 0;
  private slide: Phaser.Tweens.Tween | null = null;
  private bobTween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    createTreasureTextures(scene);
    bakeTexture(scene, PANEL_TEXTURE, win.width, win.height + win.shadowOffset, (g) => {
      g.fillStyle(PALETTE.panelShadow, 1).fillRoundedRect(
        0,
        win.shadowOffset,
        win.width,
        win.height,
        win.radius,
      );
      g.fillStyle(PALETTE.panel, 1).fillRoundedRect(0, 0, win.width, win.height, win.radius);
    });
    const face = scene.add.image(0, 0, PANEL_TEXTURE).setOrigin(0.5, 0);
    this.title = createOutlinedText(scene, 0, win.titleY, t('continue.title'), win.titleFont);
    this.heightText = createOutlinedText(scene, 0, win.heightY, '', win.heightFont, PALETTE.gold);
    this.ring = scene.add.graphics({ x: 0, y: win.timerY });
    this.digit = createOutlinedText(scene, 0, win.timerY, '', timer.digitFont);

    this.adLabel = createOutlinedText(scene, 0, 0, t('continue.watchAd'), btn.font);
    this.adButton = createLabelButton(
      scene,
      0,
      win.adButtonY,
      this.adLabel,
      PALETTE.accent,
      btn,
      'ui_continue_button',
      () => void this.flow?.watchAd(),
    ).breathe();
    this.berryLabel = createOutlinedText(scene, 0, 0, '', btn.font);
    this.berryButton = this.createBerryButton();
    this.declineText = createOutlinedText(
      scene,
      0,
      win.declineY,
      t('continue.decline'),
      decline.font,
    );
    this.declineText.setInteractive();
    this.declineText.on(Phaser.Input.Events.POINTER_UP, () => this.flow?.decline());

    this.bob = scene.add.container(0, 0, [
      face,
      this.title,
      this.heightText,
      this.ring,
      this.digit,
      this.adButton,
      this.berryButton,
      this.declineText,
    ]);
    this.panel = scene.add.container(0, 0, [this.bob]).setDepth(DEPTH).setVisible(false);
    this.setButtonsEnabled(false);
  }

  /** Screen area of the window while it is on screen, so taps on it do not drop a layer. */
  bounds(): UiRegion | null {
    if (!this.shown) return null;
    return {
      x: this.panel.x - win.width / 2,
      y: this.panel.y,
      width: win.width,
      height: win.height + win.shadowOffset,
    };
  }

  layout(width: number, height: number): void {
    this.screenH = height;
    this.panel.x = width / 2;
    if (this.shown && !this.slide?.isPlaying()) this.panel.y = this.targetY();
  }

  /** Follows the flow every frame: opens, runs and closes the window. `runHeight` is the tower height. */
  update(flow: ContinueFlow | null, runHeight: number): void {
    this.flow = flow;
    if (!flow?.isOpen) {
      if (this.shown) this.hide();
      return;
    }
    if (!this.shown) this.show(runHeight);
    this.drawTimer(flow);
    this.syncButtons(flow);
  }

  private show(runHeight: number): void {
    this.shown = true;
    this.declineShown = false;
    this.lastDigit = -1;
    this.heightText.setText(t('continue.height', { n: formatNumber(runHeight) }));
    this.scene.tweens.killTweensOf(this.declineText);
    this.declineText.setAlpha(0);
    this.panel.setVisible(true).setY(this.screenH);
    this.slideTo(this.targetY(), win.slideInMs, win.slideInEase);
    this.startBob();
    this.pulse(this.title, 0);
    this.pulse(this.heightText, TITLE_PULSE.ms / 2);
    playCues(cuesForMoment('offerOpened'), services);
  }

  private hide(): void {
    this.shown = false;
    this.setButtonsEnabled(false);
    this.slideTo(this.screenH, win.slideOutMs, win.slideOutEase, () => {
      if (!this.shown) this.panel.setVisible(false);
    });
    this.bobTween?.stop();
    this.bobTween = null;
    this.bob.y = 0;
  }

  private targetY(): number {
    return this.screenH - win.bottomMargin - win.height;
  }

  private slideTo(y: number, duration: number, ease: string, onComplete?: () => void): void {
    this.slide?.stop();
    this.slide = this.scene.tweens.add({ targets: this.panel, y, duration, ease, onComplete });
  }

  private startBob(): void {
    this.bobTween?.stop();
    this.bobTween = this.scene.tweens.add({
      targets: this.bob,
      y: { from: 0, to: -win.bobDistance },
      duration: win.bobPeriodMs / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** A slow breathing so no text of the window stands still. */
  private pulse(target: Phaser.GameObjects.Text, delay: number): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(1);
    this.scene.tweens.add({
      targets: target,
      scale: TITLE_PULSE.scale,
      duration: TITLE_PULSE.ms,
      delay,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** The ring of the remaining time and the seconds in its middle. */
  private drawTimer(flow: ContinueFlow): void {
    const left = flow.remainingMs;
    const urgent = left <= CONTINUE_ANIM.urgentFromMs;
    const share = Math.min(1, left / BALANCE.continues.offerMs);
    const color = urgent ? timer.urgentColor : timer.color;
    const g = this.ring.clear();
    g.lineStyle(timer.ringWidth, PALETTE.panelShadow, timer.trackAlpha + 0.4);
    g.beginPath().arc(0, 0, timer.radius, 0, FULL_TURN).strokePath();
    if (share > 0) {
      g.lineStyle(timer.ringWidth, color, 1);
      g.beginPath()
        .arc(0, 0, timer.radius, START_ANGLE, START_ANGLE + FULL_TURN * share)
        .strokePath();
    }
    const digit = Math.ceil(left / 1000);
    if (digit === this.lastDigit) return;
    if (this.lastDigit !== -1 && urgent) playCues(cuesForMoment('timerTick'), services);
    this.lastDigit = digit;
    this.digit.setText(String(digit)).setColor(cssColor(color));
    this.scene.tweens.add({
      targets: this.digit,
      scale: { from: timer.popScale, to: 1 },
      duration: timer.popMs,
      ease: 'Back.easeOut',
    });
  }

  /** Which buttons show, what they say and whether they react. */
  private syncButtons(flow: ContinueFlow): void {
    const offer = flow.offer;
    if (!offer) return;
    const busy = flow.adBusy;
    const rows: Button[] = [];
    this.adButton.setVisible(offer.ad !== null);
    if (offer.ad !== null) {
      const ready = offer.ad === 'ready';
      this.adLabel.setText(t(ready ? 'continue.watchAd' : 'continue.adUnavailable'));
      this.adButton.setAlpha(ready ? 1 : btn.disabledAlpha);
      this.enable(this.adButton, ready && !busy);
      rows.push(this.adButton);
    }
    this.berryButton.setVisible(offer.berryCost !== null);
    if (offer.berryCost !== null) {
      this.berryLabel.setText(formatNumber(offer.berryCost));
      this.enable(this.berryButton, !busy);
      rows.push(this.berryButton);
    } else {
      this.enable(this.berryButton, false);
    }
    const step = win.berryButtonY - win.adButtonY;
    rows.forEach((row, i) => row.setY(win.adButtonY + i * step));
    this.syncDecline(flow);
  }

  private syncDecline(flow: ContinueFlow): void {
    if (this.declineShown || !flow.declineReady) return;
    this.declineShown = true;
    const { width, height } = this.declineText;
    this.declineText.input?.hitArea.setTo(
      (width - decline.hitWidth) / 2,
      (height - decline.hitHeight) / 2,
      decline.hitWidth,
      decline.hitHeight,
    );
    const [low, high] = decline.alphaRange;
    this.declineText.setAlpha(0);
    this.scene.tweens.killTweensOf(this.declineText);
    this.scene.tweens.add({
      targets: this.declineText,
      alpha: high,
      duration: decline.fadeInMs,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.declineText,
          alpha: low,
          duration: decline.pulseMs / 2,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.enable(this.adButton, enabled);
    this.enable(this.berryButton, enabled);
  }

  private enable(button: Button, enabled: boolean): void {
    if (this.enabledNow.get(button) === enabled) return;
    this.enabledNow.set(button, enabled);
    button.setEnabled(enabled);
  }

  /** Price on a button: the number and the drawn berry next to it. */
  private createBerryButton(): Button {
    const icon = this.scene.add.image(0, 0, TREASURE_TEXTURES.berry);
    icon.setDisplaySize(btn.berryIconSize, btn.berryIconSize);
    const content = this.scene.add.container(0, 0, [this.berryLabel, icon]);
    // The label is a placeholder wide enough for two digits; the icon sits after the number.
    this.berryLabel.setText('30');
    const half = (this.berryLabel.width + btn.berryGap + btn.berryIconSize) / 2;
    this.berryLabel.setX(-half + this.berryLabel.width / 2);
    icon.setX(half - btn.berryIconSize / 2);
    return new Button(this.scene, {
      x: 0,
      y: win.berryButtonY,
      width: btn.width,
      height: btn.height,
      radius: btn.radius,
      fill: PALETTE.accentSecondary,
      shadowColor: PALETTE.textDark,
      shadowOffset: btn.shadowOffset,
      textureKey: BERRY_BUTTON_TEXTURE,
      content,
      onClick: () => {
        this.flow?.payWithBerries();
      },
    }).breathe();
  }
}

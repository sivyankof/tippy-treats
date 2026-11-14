import * as Phaser from 'phaser';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { services } from '../../services';
import type { ContinueFlow } from '../continue-flow';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { createTreasureTextures } from '../fx/treasure-textures';
import { bakeTexture } from './bake-texture';
import { ContinueButtons } from './continue-buttons';
import { ContinueTimer } from './continue-timer';
import { createOutlinedText } from './outlined-text';
import type { UiRegion } from './ui-regions';

const { window: win, decline, ease } = CONTINUE_ANIM;
const PANEL_TEXTURE = 'ui_continue_panel';

/**
 * The "Continue?" window: slides in from the bottom, shows the tower height, a ring timer
 * and the ways to go on. It only draws what the `ContinueFlow` says and passes taps to it.
 */
export class ContinueWindow {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly bob: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly heightText: Phaser.GameObjects.Text;
  private readonly timer: ContinueTimer;
  private readonly buttons: ContinueButtons;
  private readonly declineText: Phaser.GameObjects.Text;
  private flow: ContinueFlow | null = null;
  private shown = false;
  private declineShown = false;
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
    this.timer = new ContinueTimer(scene, win.timerY);
    this.buttons = new ContinueButtons(scene, {
      onWatchAd: () => void this.flow?.watchAd(),
      onPayBerries: () => void this.flow?.payWithBerries(),
    });
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
      this.timer.root,
      this.buttons.ad,
      this.buttons.berry,
      this.declineText,
    ]);
    this.panel = scene.add.container(0, 0, [this.bob]).setDepth(win.depth).setVisible(false);
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
    this.timer.update(flow);
    if (flow.offer) this.buttons.sync(flow.offer, flow.adBusy);
    this.syncDecline(flow);
  }

  private show(runHeight: number): void {
    this.shown = true;
    this.declineShown = false;
    this.timer.reset();
    this.heightText.setText(t('continue.height', { n: formatNumber(runHeight) }));
    this.scene.tweens.killTweensOf(this.declineText);
    this.declineText.setAlpha(0);
    this.panel.setVisible(true).setY(this.screenH);
    this.slideTo(this.targetY(), win.slideInMs, win.slideInEase);
    this.startBob();
    this.pulse(this.title, 0);
    this.pulse(this.heightText, win.titlePulse.ms / 2);
    playCues(cuesForMoment('offerOpened'), services);
  }

  private hide(): void {
    this.shown = false;
    this.buttons.disable();
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
      ease: ease.sine,
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
      scale: win.titlePulse.scale,
      duration: win.titlePulse.ms,
      delay,
      ease: ease.sine,
      yoyo: true,
      repeat: -1,
    });
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
          ease: ease.sine,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }
}

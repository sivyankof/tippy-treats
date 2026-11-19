import * as Phaser from 'phaser';
import { CONTINUE_ANIM } from '../../data/run/continue-anim';
import { MENU } from '../../data/common/menu-layout';
import { PALETTE } from '../../data/common/palette';
import { formatNumber, t } from '../../i18n';
import { services } from '../../services';
import type { ContinueFlow } from '../continue-flow';
import { continueInput } from '../continue-input';
import { windowDuck } from '../music-cues';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { createTreasureTextures } from '../fx/treasure-textures';
import { flyBerries } from './continue-berry-flight';
import { ContinueButtons } from './continue-buttons';
import { ContinueTimer } from './continue-timer';
import { createOutlinedText } from './outlined-text';
import { TitleRibbon } from './style/title-ribbon';
import { BalanceChip } from './style/balance-chip';
import { createPlate } from './style/volume';
import type { UiRegion } from './ui-regions';

const { window: win, decline, ease, button: btn } = CONTINUE_ANIM;
/** The right end of the balance chip lines up with the buttons. */
const balanceRight = btn.width / 2;
/** The ribbon title stands this far above the top edge of the window. */
const ribbonReach = MENU.style.ribbon.height / 2;

/**
 * The "Continue?" window: a window plate of the kit with a ribbon title; it slides in from the
 * bottom, shows the tower height, the kit's ring timer and the ways to go on. It only draws what the `ContinueFlow` says and passes taps to it.
 */
export class ContinueWindow {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly bob: Phaser.GameObjects.Container;
  private readonly heightText: Phaser.GameObjects.Text;
  private readonly timer: ContinueTimer;
  private readonly buttons: ContinueButtons;
  private readonly balance: BalanceChip;
  private readonly declineText: Phaser.GameObjects.Text;
  private flow: ContinueFlow | null = null;
  private shown = false;
  private declineShown = false;
  private screenH = 0;
  private slide: Phaser.Tweens.Tween | null = null;
  private bobTween: Phaser.Tweens.Tween | null = null;
  /** Lets the music duck go; set while the window is shown. */
  private releaseDuck: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    createTreasureTextures(scene);
    const plate = createPlate(scene, 'window', 0, win.height / 2, win.width, win.height);
    const title = new TitleRibbon(scene, 0, 0, t('continue.title'));
    this.heightText = createOutlinedText(scene, 0, win.heightY, '', win.heightFont, PALETTE.gold);
    this.timer = new ContinueTimer(scene, win.timerY);
    this.buttons = new ContinueButtons(scene, {
      onWatchAd: () => void this.flow?.watchAd(),
      onPayBerries: () => this.payWithBerries(),
      onShort: () => this.balance.shake(),
    });
    this.balance = new BalanceChip(scene, 'berries', balanceRight, win.balanceY);
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
      plate,
      title,
      this.heightText,
      this.timer.root,
      this.balance.root,
      this.buttons.root,
      this.declineText,
    ]);
    this.panel = scene.add.container(0, 0, [this.bob]).setDepth(win.depth).setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.letDuckGo());
  }

  /** Screen area of the window while it is on screen, so taps on it do not drop a layer. */
  bounds(): UiRegion | null {
    if (!this.shown) return null;
    return {
      x: this.panel.x - win.width / 2,
      y: this.panel.y - ribbonReach,
      width: win.width,
      height: win.height + ribbonReach,
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
    if (flow?.isOpen && !this.shown) this.show(flow, runHeight);
    // The balance keeps rolling for as long as the window is on screen.
    if (this.panel.visible && flow) this.balance.update(flow.balance);
    if (!flow?.isOpen) {
      if (this.shown) this.hide();
      return;
    }
    this.timer.update(flow);
    // While a payment is shown the buttons stay off.
    if (flow.paying) this.buttons.disable();
    else if (flow.offer) {
      this.buttons.sync(flow.offer, flow.adBusy);
      this.buttons.setActive(flow.inputReady);
    }
    this.syncDecline(flow);
  }

  /** Taps the pay button: berries fly into it on success, the balance shakes when short. */
  private payWithBerries(): void {
    const flow = this.flow;
    const offer = flow?.offer;
    if (!flow || !offer) return;
    if (offer.berriesMissing > 0) {
      this.balance.shake();
      return;
    }
    if (!flow.payWithBerries()) return;
    const button = this.buttons.payButton;
    flyBerries(this.scene, this.bob, this.balance.position, button, offer.berryCost);
  }

  private show(flow: ContinueFlow, runHeight: number): void {
    this.shown = true;
    this.letDuckGo();
    this.releaseDuck = windowDuck.hold();
    this.balance.snap(flow.balance);
    this.declineShown = false;
    this.timer.reset();
    this.heightText.setText(t('continue.height', { n: formatNumber(runHeight) }));
    this.scene.tweens.killTweensOf(this.declineText);
    this.fitDeclineHit();
    this.declineText.setAlpha(continueInput(0).declineAlpha);
    this.buttons.setActive(false);
    this.panel.setVisible(true).setY(this.offscreenY());
    this.slideTo(this.targetY(), win.slideInMs, win.slideInEase);
    this.startBob();
    this.pulse(this.heightText);
    playCues(cuesForMoment('offerOpened'), services);
  }

  private hide(): void {
    this.shown = false;
    this.letDuckGo();
    this.buttons.disable();
    this.slideTo(this.offscreenY(), win.slideOutMs, win.slideOutEase, () => {
      if (!this.shown) this.panel.setVisible(false);
    });
    this.bobTween?.stop();
    this.bobTween = null;
    this.bob.y = 0;
  }

  private letDuckGo(): void {
    this.releaseDuck?.();
    this.releaseDuck = null;
  }

  /** Below the bottom edge, ribbon included. */
  private offscreenY(): number {
    return this.screenH + ribbonReach;
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
  private pulse(target: Phaser.GameObjects.Text): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(1);
    this.scene.tweens.add({
      targets: target,
      scale: win.titlePulse.scale,
      duration: win.titlePulse.ms,
      ease: ease.sine,
      yoyo: true,
      repeat: -1,
    });
  }

  /** The tap area of the small button, centred on its caption. */
  private fitDeclineHit(): void {
    const { width, height } = this.declineText;
    this.declineText.input?.hitArea.setTo(
      (width - decline.hitWidth) / 2,
      (height - decline.hitHeight) / 2,
      decline.hitWidth,
      decline.hitHeight,
    );
  }

  /** The pale caption turns normal at the moment the buttons switch on and stays so. */
  private syncDecline(flow: ContinueFlow): void {
    if (this.declineShown || !flow.inputReady) return;
    this.declineShown = true;
    this.fitDeclineHit();
    this.scene.tweens.killTweensOf(this.declineText);
    this.scene.tweens.add({
      targets: this.declineText,
      alpha: continueInput(flow.elapsedMs).declineAlpha,
      duration: decline.fadeInMs,
    });
  }
}

import * as Phaser from 'phaser';
import { pushBack } from '../../app/back-stack';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { windowDuck } from '../../audio/music-cues';
import { createDimOverlay } from '../common/dim-overlay';
import { safeFrame } from '../common/safe-frame';
import { createIconButton } from '../menu/widgets/icon-button';
import { openPopup } from '../common/transition';
import { TitleRibbon } from './title-ribbon';
import { closeSteps, pressBeganHere, type VeilHandover } from './veil-handover';
import { popupReserve, popupRoom } from './window-fit';
import { VolumePlate } from './volume';

const cfg = MENU.popup;

export interface PopupOptions {
  title: string;
  /** Height of the content; change it later with `setContentHeight`. */
  contentHeight?: number;
  /** Show the round close (x) button. Default true. */
  closable?: boolean;
  /** A tap on the veil closes the window. Default: the same as `closable`. */
  closeOnVeil?: boolean;
  /** Stacking layer: 0 for a window over a screen, 1 for one over another window. Default 0. */
  layer?: number;
  /** Runs once the window is gone. */
  onClosed?: () => void;
  /**
   * The Android back while the window shows (`game/app/back-stack.ts`): `close` closes it like the
   * close button, `hold` takes it and does nothing (a window that waits for its own buttons),
   * `pass` leaves it to whatever is under the window (its owner handles it). Default: `close` for
   * a closable window, `hold` otherwise.
   */
  back?: 'close' | 'hold' | 'pass';
  /**
   * How the veil comes and goes when one window takes the place of another (the journal and its
   * windows): `in: 'shown'` starts at full darkness, `out: 'keep'` leaves it dark while the window
   * shrinks and opens the next window (`onClosed`) before this one is gone. Default: both fade.
   */
  veil?: VeilHandover;
}

/**
 * A popup window of the menus in the volumetric style: a dim veil that blocks everything under
 * it, a window plate sized by its content, a ribbon title on the top edge, an optional close
 * button and a `content` container.
 *
 * Content coordinates: x = 0 is the middle of the window, y = 0 the top of the content area,
 * the usable width is `innerWidth`. Example:
 *
 *   const popup = new PopupWindow(scene, { title: t('missions.title'), onClosed });
 *   popup.content.add(scene.add.text(0, 0, '...'));
 *   popup.setContentHeight(400);
 *   // later: popup.close();
 *
 * It follows screen resizes (and shrinks to fit a short screen) and stands in the safe band of
 * the canvas (the veil covers all of it), goes away with its scene, pops
 * in with `openPopup`, shrinks and fades out on close, then destroys itself.
 */
export class PopupWindow {
  /** Where to put the content of the window. */
  readonly content: Phaser.GameObjects.Container;
  /** Width left for the content between the paddings. */
  readonly innerWidth = cfg.width - cfg.padX * 2;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  /** Holds the parts; scaled down on a short screen while `root` plays the pop animation. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly ribbon: TitleRibbon;
  private readonly closeButton: Phaser.GameObjects.Container | null = null;
  private plate: VolumePlate | null = null;
  private shield: Phaser.GameObjects.Zone | null = null;
  private contentHeight: number;
  private closing = false;
  private gone = false;
  /** Every open window turns the music down until it is gone (nested windows count). */
  private readonly releaseDuck = windowDuck.hold();
  private readonly releaseBack: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: PopupOptions,
  ) {
    const { width, height } = scene.scale.gameSize;
    const closable = options.closable ?? true;
    const back = options.back ?? (closable ? 'close' : 'hold');
    this.releaseBack =
      back === 'pass'
        ? () => undefined
        : pushBack(() => {
            if (back === 'close') this.close();
            return true;
          });
    this.contentHeight = options.contentHeight ?? cfg.minContentHeight;
    const depth = cfg.depth + (options.layer ?? 0) * cfg.layerStep;
    this.dim = createDimOverlay(scene, cfg.dimAlpha, width, height)
      .setInteractive()
      .setDepth(depth);
    if (options.closeOnVeil ?? closable) {
      // Only a tap on the veil closes: a drag that began inside the window (a scrolling list) and
      // ends over the veil must not.
      let veilDownAt = -1;
      this.dim.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        veilDownAt = pointer.downTime;
      });
      this.dim.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (pressBeganHere(veilDownAt, pointer.downTime)) this.close();
      });
    }
    this.content = scene.add.container(0, 0);
    this.ribbon = new TitleRibbon(scene, 0, 0, options.title);
    this.body = scene.add.container(0, 0);
    this.root = scene.add
      .container(width / 2, safeFrame(height).centerY, [this.body])
      .setDepth(depth + 1);
    if (closable) {
      this.closeButton = createIconButton(
        scene,
        0,
        0,
        cfg.close.size,
        PALETTE.danger,
        'close',
        this.close,
      );
    }
    this.rebuild();
    this.layout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    openPopup(scene, this.dim, this.root, options.veil?.in === 'shown');
  }

  /** The window without its veil: what slides away when the whole screen leaves (`leaveScreen`). */
  get frame(): Phaser.GameObjects.Container {
    return this.root;
  }

  /** The window is going away (closing or gone): its content must not act any more. */
  get leaving(): boolean {
    return this.closing || this.gone;
  }

  /** Total height of the window body. */
  get height(): number {
    return cfg.titleSpace + this.contentHeight + cfg.padBottom;
  }

  /** Resizes the window to a content of `height` pixels. */
  setContentHeight(height: number): void {
    const next = Math.max(cfg.minContentHeight, Math.round(height));
    if (next === this.contentHeight) return;
    this.contentHeight = next;
    this.rebuild();
    this.layout();
  }

  /** Closes with the shrinking animation and destroys the window; safe to call twice. */
  readonly close = (): void => {
    if (this.closing || this.gone) return;
    this.closing = true;
    this.dim.disableInteractive();
    const keep = this.options.veil?.out === 'keep';
    if (!keep) this.scene.tweens.add({ targets: this.dim, alpha: 0, duration: cfg.closeMs });
    this.scene.tweens.add({
      targets: this.root,
      scale: cfg.closeScale,
      alpha: 0,
      duration: cfg.closeMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        for (const step of closeSteps(keep)) {
          if (step === 'destroy') this.destroy();
          else this.options.onClosed?.();
        }
      },
    });
  };

  /** Removes everything at once, without the animation and without `onClosed`. */
  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.releaseDuck();
    this.releaseBack();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.tweens.killTweensOf([this.dim, this.root]);
    this.dim.destroy();
    this.root.destroy();
  }

  /** Redraws the plate for the current content height and puts the parts in place. */
  private rebuild(): void {
    const top = -this.height / 2;
    this.plate?.destroy();
    this.plate = new VolumePlate(this.scene, 'window', this.height).setBodyWidth(cfg.width);
    // A zone under the parts takes taps inside the window so they never reach the veil.
    this.shield?.destroy();
    this.shield = this.scene.add.zone(0, 0, cfg.width, this.height).setInteractive();
    this.body.add([this.shield, this.plate, this.content, this.ribbon]);
    if (this.closeButton) this.body.add(this.closeButton);
    this.ribbon.setPosition(0, top);
    this.content.setPosition(0, top + cfg.titleSpace);
    this.closeButton?.setPosition(
      cfg.width / 2 - cfg.close.size / 2 - cfg.close.inset,
      top + cfg.close.size / 2 + cfg.close.inset,
    );
    this.body.sendToBack(this.plate);
    this.body.sendToBack(this.shield);
  }

  private layout(): void {
    if (this.gone) return;
    const { width, height } = this.scene.scale.gameSize;
    // The run's scenes are laid out below the island: their camera scrolls by the top inset. The
    // veil and the window stand on the canvas, wherever the camera of their scene is.
    const cam = this.scene.cameras.main;
    this.dim.setSize(width, height).setPosition(cam.scrollX, cam.scrollY);
    // The veil covers the whole canvas; the window stands in the safe band, clear of the island and the gesture bar.
    const frame = safeFrame(height);
    // Under an island the ribbon, half of which stands above the window, must clear the band too:
    // the window then fits with it and moves down by half of it. Without a top inset (a browser)
    // the window keeps its old place.
    const ribbonHalf = MENU.style.ribbon.height / 2;
    const overhang = frame.top > 0 ? ribbonHalf : 0;
    // Where the window stays centred, the ribbon sticks out above it by `ribbonHalf` and the window has
    // to leave the same room below, so the ribbon never reaches the screen edge; under an island the
    // window moves down by the overhang instead.
    const reserve = popupReserve(frame.top);
    const fit = Math.min(
      1,
      (width - cfg.screenMargin * 2) / cfg.width,
      (popupRoom(frame.height, frame.top) + reserve) / (this.height + reserve),
    );
    this.root.setPosition(
      cam.scrollX + width / 2,
      cam.scrollY + frame.centerY + (overhang * fit) / 2,
    );
    this.body.setScale(fit);
  }
}

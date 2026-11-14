import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createDimOverlay } from '../dim-overlay';
import { createIconButton } from '../menu/icon-button';
import { openPopup } from '../transition';
import { TitleRibbon } from './title-ribbon';
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
  /** Runs once the window is gone. */
  onClosed?: () => void;
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
 * It follows screen resizes (and shrinks to fit a short screen), goes away with its scene, pops
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: PopupOptions,
  ) {
    const { width, height } = scene.scale.gameSize;
    const closable = options.closable ?? true;
    this.contentHeight = options.contentHeight ?? cfg.minContentHeight;
    this.dim = createDimOverlay(scene, cfg.dimAlpha, width, height)
      .setInteractive()
      .setDepth(cfg.depth);
    if (options.closeOnVeil ?? closable)
      this.dim.on(Phaser.Input.Events.POINTER_UP, this.close, this);
    this.content = scene.add.container(0, 0);
    this.ribbon = new TitleRibbon(scene, 0, 0, options.title);
    this.body = scene.add.container(0, 0);
    this.root = scene.add.container(width / 2, height / 2, [this.body]).setDepth(cfg.depth + 1);
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
    openPopup(scene, this.dim, this.root);
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
    this.scene.tweens.add({ targets: this.dim, alpha: 0, duration: cfg.closeMs });
    this.scene.tweens.add({
      targets: this.root,
      scale: cfg.closeScale,
      alpha: 0,
      duration: cfg.closeMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.destroy();
        this.options.onClosed?.();
      },
    });
  };

  /** Removes everything at once, without the animation and without `onClosed`. */
  destroy(): void {
    if (this.gone) return;
    this.gone = true;
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
    this.dim.setSize(width, height);
    const fit = Math.min(
      1,
      (width - cfg.screenMargin * 2) / cfg.width,
      (height - cfg.screenMargin * 2) / this.height,
    );
    this.root.setPosition(width / 2, height / 2);
    this.body.setScale(fit);
  }
}

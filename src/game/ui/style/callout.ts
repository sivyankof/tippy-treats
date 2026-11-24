import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { shade } from '../../../util/color';
import { effectsMode } from '../../app/effects-mode';
import { pushBack } from '../../app/back-stack';
import { bakeTexture } from '../common/bake-texture';
import { createDimOverlay } from '../common/dim-overlay';
import { createPlate, lookOf } from './volume';

const cfg = MENU.style.callout;
const S = MENU.style;

/** Key of the arrow of a callout: a triangle pointing up, outlined like the plate under it. */
export const CALLOUT_ARROW_KEY = 'ui_callout_arrow';

/** Room around the arrow picture, so it never touches the edge of its frame. */
const ARROW_PAD = 4;

/** Bakes the arrow once: the plate outline colour, the plate face inside it. */
export function bakeCalloutArrow(scene: Phaser.Scene): void {
  const { width, height } = cfg.arrow;
  const outline = lookOf('card').outline;
  const w = width + ARROW_PAD * 2;
  const h = height + outline + ARROW_PAD * 2;
  bakeTexture(scene, CALLOUT_ARROW_KEY, w, h, (g) => {
    const left = ARROW_PAD;
    const bottom = ARROW_PAD + height + outline;
    g.fillStyle(shade(cfg.fill, S.outlineShade), 1);
    g.fillTriangle(left, bottom, left + width, bottom, left + width / 2, ARROW_PAD);
    const inset = outline * 1.6;
    g.fillStyle(cfg.fill, 1);
    g.fillTriangle(
      left + inset,
      bottom,
      left + width - inset,
      bottom,
      left + width / 2,
      ARROW_PAD + inset,
    );
  });
}

export interface CalloutOptions {
  /**
   * What was tapped: it is lifted over the dim while the hint is open (it keeps taking taps) and
   * put back in its container when the hint closes; the hint points at it.
   */
  lift: Phaser.GameObjects.Container;
  /** Width of the plate body. */
  width: number;
  /** The content; its (0, 0) becomes the top-centre of the content area. */
  content: Phaser.GameObjects.Container;
  contentHeight: number;
  onClosed?: () => void;
}

/**
 * A hint over a dimmed screen: the screen dims, what was tapped stays lit over the dim and keeps
 * taking taps, a plate with an arrow pointing at it shows the content below it (above it when
 * there is no room below). A tap on the dim or the Android back closes it; so does `close` (a
 * second tap on what opened it).
 */
export class Callout {
  private readonly root: Phaser.GameObjects.Container;
  private readonly veils: Phaser.GameObjects.Rectangle[];
  /** Holds the lifted object over the dim, where it stood on the screen. */
  private readonly holder: Phaser.GameObjects.Container;
  private readonly home: {
    parent: Phaser.GameObjects.Container | null;
    index: number;
    x: number;
    y: number;
  };
  private readonly releaseBack: () => void;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: CalloutOptions,
  ) {
    const view = scene.cameras.main.worldView;
    const { lift } = options;
    const anchor = lift.getBounds();
    this.veils = [
      createDimOverlay(scene, cfg.dimAlpha, view.width, view.height)
        .setPosition(view.x, view.y)
        .setDepth(cfg.depth)
        .setInteractive()
        .on(Phaser.Input.Events.POINTER_UP, () => this.close()),
    ];
    // The tapped object moves over the dim at the same place and size; `close` puts it back.
    const parent = lift.parentContainer;
    this.home = { parent, index: parent ? parent.getIndex(lift) : -1, x: lift.x, y: lift.y };
    const m = lift.getWorldTransformMatrix();
    parent?.remove(lift);
    this.holder = scene.add
      .container(m.tx, m.ty, [lift.setPosition(0, 0)])
      .setScale(m.scaleX, m.scaleY)
      .setDepth(cfg.depth + 1);

    const bodyHeight = options.contentHeight + cfg.padY * 2;
    const arrowRise = cfg.arrow.height;
    const below = anchor.bottom + cfg.gap + arrowRise + bodyHeight <= view.bottom;
    const centreY = below
      ? anchor.bottom + cfg.gap + arrowRise + bodyHeight / 2
      : anchor.top - cfg.gap - arrowRise - bodyHeight / 2;
    const half = options.width / 2;
    const centreX = Phaser.Math.Clamp(
      anchor.centerX,
      view.x + cfg.screenMargin + half,
      view.right - cfg.screenMargin - half,
    );
    const plate = createPlate(scene, 'card', 0, 0, options.width, bodyHeight, { fill: cfg.fill });
    bakeCalloutArrow(scene);
    const outline = lookOf('card').outline;
    const arrowX = Phaser.Math.Clamp(
      anchor.centerX - centreX,
      -half + cfg.arrow.width,
      half - cfg.arrow.width,
    );
    // The arrow's base sinks into the plate outline so the two read as one shape.
    const arrow = scene.add.image(arrowX, 0, CALLOUT_ARROW_KEY);
    const baseShare = ARROW_PAD / arrow.height;
    if (below) arrow.setOrigin(0.5, 1 - baseShare).setY(-bodyHeight / 2 + outline);
    else
      arrow
        .setFlipY(true)
        .setOrigin(0.5, baseShare)
        .setY(bodyHeight / 2 - outline);
    options.content.setPosition(0, -bodyHeight / 2 + cfg.padY);
    this.root = scene.add
      .container(centreX, centreY, [plate, arrow, options.content])
      .setDepth(cfg.depth + 2);
    this.releaseBack = pushBack(() => {
      this.close();
      return true;
    });
    this.appear();
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  /** Fades the hint and the dim out, then destroys them. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.releaseBack();
    this.putBack();
    const targets = [this.root, ...this.veils];
    for (const veil of this.veils) veil.disableInteractive();
    this.scene.tweens.killTweensOf(targets);
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: cfg.closeMs,
      onComplete: () => {
        for (const target of targets) target.destroy();
        this.options.onClosed?.();
      },
    });
  }

  /** The lifted object goes back into its container, where it was. */
  private putBack(): void {
    const { lift } = this.options;
    const { parent, index, x, y } = this.home;
    this.holder.remove(lift);
    if (parent?.active) parent.addAt(lift.setPosition(x, y), index);
    this.holder.destroy();
  }

  private appear(): void {
    // The dim keeps its own fill alpha; the objects fade in from nothing.
    for (const veil of this.veils) veil.setAlpha(0);
    this.root.setAlpha(0);
    this.scene.tweens.add({ targets: this.veils, alpha: 1, duration: cfg.openMs });
    if (effectsMode.reduced) {
      this.scene.tweens.add({ targets: this.root, alpha: 1, duration: cfg.openMs });
      return;
    }
    this.root.setScale(cfg.openScale);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scale: 1,
      duration: cfg.openMs,
      ease: 'Back.easeOut',
    });
  }
}

import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../data/ability-anim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { artRecipe } from '../../data/creature-looks';
import { shade } from '../../util/color';
import { combineWiden } from '../fx/anim-curves';
import { twinsSeam } from './creature-art/twins-seam';
import type { LayerFace } from './layer-face';
import { DARK_OUTLINE, layerBox } from './layer-draw';

const HALF = BALANCE.layer.height / 2;

const cfg = ABILITY_ANIM.rig;

/** How the twins come apart: the top shell lifts `liftPx` above the bottom one and settles back. */
export interface SplitOptions {
  /** Width of the layer. */
  width: number;
  liftPx: number;
  /** Each way (up, down) takes this long; the shell holds `holdMs` at the top. */
  liftMs: number;
  holdMs: number;
  ease: string;
  /** The cream that shows in the gap. */
  creamColor: number;
  creamAlpha: number;
}

/**
 * The extra animations of a layer view that the abilities need: a coloured flash, a hop, the
 * body fading to see-through, the layer coming apart into two shells. Values that tweens drive
 * (`hopY`, `bodyAlpha`, `split`) are applied to the containers once per frame by `apply`, so
 * a squash or a reset of the containers cannot leave them in a stray pose.
 */
export class LayerRig {
  /** Tinted copy of the art, shown for a flash. */
  private readonly flashImage: Phaser.GameObjects.Image;
  private readonly shellTop: Phaser.GameObjects.Image;
  private readonly shellBottom: Phaser.GameObjects.Image;
  private readonly cream: Phaser.GameObjects.Rectangle;
  private content!: Phaser.GameObjects.Container;
  private squashRoot!: Phaser.GameObjects.Container;
  private artHidden = false;
  /** Where the gap opens (y around the layer centre) and how wide it is, while the shells are apart. */
  private seamY = 0;
  private gapWidth = 1;

  /** How high the layer is lifted (px), how see-through the body is, how far the top shell is lifted (px). */
  hopY = 0;
  bodyAlpha = 1;
  split = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly art: Phaser.GameObjects.Image,
    private readonly face: LayerFace,
  ) {
    const image = (): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
    this.shellTop = image();
    this.shellBottom = image();
    this.flashImage = image().setTintMode(Phaser.TintModes.FILL);
    this.cream = new Phaser.GameObjects.Rectangle(scene, 0, 0, 1, 1).setVisible(false);
  }

  /** Display objects to put into the content container, between the art and the gloss. */
  get parts(): Phaser.GameObjects.GameObject[] {
    return [this.shellTop, this.shellBottom, this.cream, this.flashImage];
  }

  attach(content: Phaser.GameObjects.Container, squashRoot: Phaser.GameObjects.Container): void {
    this.content = content;
    this.squashRoot = squashRoot;
  }

  /** The layer lights up in `color` and the light fades out. */
  flash(color: number, alpha: number, inMs: number, outMs: number): void {
    const image = this.flashImage;
    this.scene.tweens.killTweensOf(image);
    this.mirrorArt(image);
    image.setTint(color).setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: image,
      alpha,
      duration: inMs,
      onComplete: () => {
        this.scene.tweens.add({
          targets: image,
          alpha: 0,
          duration: outMs,
          onComplete: () => image.setVisible(false),
        });
      },
    });
  }

  /**
   * The content swells from the given scale to `peak`, then settles to 1. When the layer is
   * already widening (a combo in the same step), the start is the sum of both widenings.
   */
  inflate(
    fromScaleX: number,
    fromScaleY: number,
    peak: number,
    upMs: number,
    downMs: number,
    downEase: string,
  ): void {
    const content = this.content;
    const startX = combineWiden(fromScaleX, content.scaleX);
    this.scene.tweens.killTweensOf(content);
    content.setScale(startX, fromScaleY);
    this.scene.tweens.add({
      targets: content,
      scaleX: peak,
      scaleY: peak,
      duration: upMs,
      ease: cfg.inflateRiseEase,
      onComplete: () => {
        this.scene.tweens.add({
          targets: content,
          scaleX: 1,
          scaleY: 1,
          duration: downMs,
          ease: downEase,
        });
      },
    });
  }

  /** The layer jumps up `px` and lands back. */
  hop(px: number, ms: number): void {
    this.scene.tweens.killTweensOf(this);
    this.hopY = 0;
    this.scene.tweens.add({
      targets: this,
      hopY: px,
      duration: ms / 2,
      ease: cfg.hopEase,
      yoyo: true,
    });
  }

  /** The body fades to `alpha`, waits `holdMs` and comes back. */
  fade(alpha: number, fadeMs: number, holdMs: number): void {
    this.scene.tweens.killTweensOf(this);
    this.bodyAlpha = 1;
    this.scene.tweens.add({
      targets: this,
      bodyAlpha: alpha,
      duration: fadeMs,
      hold: holdMs,
      yoyo: true,
      ease: cfg.fadeEase,
    });
  }

  /**
   * The layer comes apart along the cream strip: the top shell lifts, cream shows in the widened
   * gap, the shell settles back. Meant for the twins.
   */
  splitApart(o: SplitOptions): void {
    const recipe = artRecipe('twins');
    if (recipe.kind !== 'twins') return;
    this.scene.tweens.killTweensOf(this);
    this.split = 0;
    const box = layerBox(o.width);
    this.seamY = twinsSeam(box, recipe).mid;
    this.gapWidth = Math.max(1, o.width - ANIM.layer.outline);
    // The picture's origin puts the layer centre on the image position; this is the seam in pixels.
    const seamPx = this.art.originY * this.art.height + this.seamY;
    const width = this.art.width;
    const height = this.art.height;
    for (const [image, cropY, cropH] of [
      [this.shellTop, 0, seamPx],
      [this.shellBottom, seamPx, height - seamPx],
    ] as const) {
      this.mirrorArt(image);
      image.setCrop(0, cropY, width, cropH).setVisible(true);
    }
    this.cream
      .setFillStyle(o.creamColor, o.creamAlpha)
      .setStrokeStyle(ANIM.layer.outline, shade(o.creamColor, DARK_OUTLINE))
      .setVisible(true);
    this.art.setVisible(false);
    this.artHidden = true;
    this.scene.tweens.add({
      targets: this,
      split: o.liftPx,
      duration: o.liftMs,
      hold: o.holdMs,
      yoyo: true,
      ease: o.ease,
      onComplete: () => this.endSplit(),
    });
  }

  /** Puts the tweened values onto the containers and the faces. */
  apply(): void {
    this.squashRoot.setY(HALF - this.hopY);
    this.content.setAlpha(this.bodyAlpha);
    if (this.artHidden) {
      this.shellTop.setY(-this.split);
      this.cream
        .setSize(this.gapWidth, Math.max(1, this.split))
        .setPosition(0, this.seamY - this.split / 2);
    }
    this.face.setPairLift(this.split);
  }

  /** Stops everything and shows the plain layer again, for reuse from a pool. */
  reset(): void {
    this.scene.tweens.killTweensOf([this, this.flashImage]);
    this.hopY = 0;
    this.bodyAlpha = 1;
    this.split = 0;
    this.flashImage.setVisible(false);
    this.endSplit();
    // The containers exist from the end of the view's constructor on.
    if (this.content) this.apply();
  }

  private endSplit(): void {
    this.shellTop.setVisible(false).setY(0).setCrop();
    this.shellBottom.setVisible(false).setCrop();
    this.cream.setVisible(false);
    if (this.artHidden) this.art.setVisible(true);
    this.artHidden = false;
  }

  /** Makes `image` show the same picture at the same place as the art. */
  private mirrorArt(image: Phaser.GameObjects.Image): void {
    image.setTexture(this.art.texture.key).setOrigin(this.art.originX, this.art.originY);
  }
}

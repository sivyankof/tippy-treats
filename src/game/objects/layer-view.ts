import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { bump } from '../fx/anim-curves';
import { FX_TEXTURES } from '../fx/fx-textures';
import { LayerFace } from './layer-face';
import { acquireLayerArt, artWidth, colorIndexFor, releaseLayerArt } from './layer-art';

type ScaleStart = { scaleX?: number; scaleY?: number };

/**
 * One cake layer: a baked picture (shadow, body, glaze, gloss) and a face on top.
 *
 * The container sits on the centre of the layer and carries the sway rotation.
 * Inside it, `squashRoot` is pinned to the bottom edge (squash and stretch pivot there)
 * and `content` to the centre of the layer (widening pivots there):
 *
 *   LayerView > squashRoot (y = +H/2) > content (y = -H/2) > art, glossSweep, face
 */
export class LayerView extends Phaser.GameObjects.Container {
  private readonly squashRoot: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Image;
  private readonly glossSweep: Phaser.GameObjects.Image;
  private readonly face: LayerFace;
  private artKey: string | null = null;
  private drawnColor = -1;
  private drawnWidth = -1;
  private drawnCut: CutSide | null = null;
  private faceEnabled = true;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const half = BALANCE.layer.height / 2;
    this.art = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
    this.glossSweep = new Phaser.GameObjects.Image(scene, 0, 0, FX_TEXTURES.glossBand)
      .setDisplaySize(ANIM.perfect.glossSweepWidth, BALANCE.layer.height - ANIM.layer.outline * 2)
      .setVisible(false);
    this.face = new LayerFace(scene);
    this.content = new Phaser.GameObjects.Container(scene, 0, -half, [
      this.art,
      this.glossSweep,
      this.face,
    ]);
    this.squashRoot = new Phaser.GameObjects.Container(scene, 0, half, [this.content]);
    this.add(this.squashRoot);
    scene.add.existing(this);
  }

  /** The face of this layer: mood, reactions, look target. */
  get faceView(): LayerFace {
    return this.face;
  }

  /**
   * Shows the baked art for the colour, width and cut side (`null`: intact layer)
   * and lays the face out for the width. Baking happens only for a new combination.
   */
  setLayer(index: number, width: number, cut: CutSide | null = null): this {
    const color = colorIndexFor(index);
    const w = artWidth(width);
    if (color === this.drawnColor && w === this.drawnWidth && cut === this.drawnCut) return this;
    const key = acquireLayerArt(this.scene, color, w, cut);
    if (this.artKey) releaseLayerArt(this.scene, this.artKey);
    this.artKey = key;
    this.drawnColor = color;
    this.drawnWidth = w;
    this.drawnCut = cut;
    this.art.setTexture(key).setVisible(true);
    this.face.layout(w);
    this.face.setVisible(this.faceEnabled);
    return this;
  }

  /** Gives the baked art back so a pooled view does not keep its texture alive; `setLayer` brings it back. */
  releaseArt(): this {
    if (this.artKey) releaseLayerArt(this.scene, this.artKey);
    this.artKey = null;
    this.drawnColor = -1;
    this.drawnWidth = -1;
    this.drawnCut = null;
    this.art.setVisible(false);
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.releaseArt();
    super.destroy(fromScene);
  }

  /** Pieces that fall off the tower have no face. */
  setFaceEnabled(enabled: boolean): this {
    this.faceEnabled = enabled;
    this.face.setVisible(enabled && this.drawnWidth > 0);
    return this;
  }

  /** Scale of the part pinned to the bottom edge: landing, falling and sneezing. */
  setSquash(scaleX: number, scaleY: number): this {
    this.squashRoot.setScale(scaleX, scaleY);
    return this;
  }

  /** Squashes at once, then springs back to the normal shape; `delayMs` postpones the squash. */
  playLanding(
    scaleX: number = ANIM.land.scaleX,
    scaleY: number = ANIM.land.scaleY,
    delayMs = 0,
  ): void {
    this.springBack(
      this.squashRoot,
      { scaleX, scaleY },
      ANIM.land.durationMs,
      ANIM.land.ease,
      delayMs,
    );
  }

  /** Quick vertical squash (a sneeze) that springs back. */
  playSqueeze(scaleY: number, durationMs: number): void {
    this.springBack(this.squashRoot, { scaleY }, durationMs, ANIM.sneeze.ease, 0);
  }

  /** The layer was `fromWidth` wide a moment ago: it puffs up from there to its width. */
  playWiden(fromWidth: number): void {
    if (this.drawnWidth <= 0) return;
    this.springBack(
      this.content,
      { scaleX: fromWidth / this.drawnWidth },
      ANIM.perfect.widenMs,
      ANIM.perfect.widenEase,
      0,
    );
  }

  /** The layer flies in squeezed wide and settles to its normal width. */
  playAppear(): void {
    const { appearScaleX, appearMs, appearEase } = ANIM.flying;
    this.springBack(this.content, { scaleX: appearScaleX }, appearMs, appearEase, 0);
  }

  /** A white band runs over the layer from left to right and fades at both ends. */
  playGlossSweep(): void {
    const { outline } = ANIM.layer;
    const { glossSweepWidth, glossSweepMs, glossSweepAlpha } = ANIM.perfect;
    const travel = this.drawnWidth / 2 - outline - glossSweepWidth / 2;
    if (travel <= 0) return;
    this.scene.tweens.killTweensOf(this.glossSweep);
    this.glossSweep.setPosition(-travel, 0).setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.glossSweep,
      x: travel,
      duration: glossSweepMs,
      onUpdate: (tween) => {
        this.glossSweep.setAlpha(glossSweepAlpha * bump(tween.progress));
      },
      onComplete: () => this.glossSweep.setVisible(false),
    });
  }

  /** Stops every animation of this layer and restores its shape, for reuse from a pool. */
  resetAnim(): this {
    this.scene.tweens.killTweensOf([this, this.squashRoot, this.content, this.glossSweep]);
    this.setScale(1).setAngle(0).setAlpha(1);
    this.squashRoot.setScale(1);
    this.content.setScale(1);
    this.glossSweep.setVisible(false);
    this.face.reset();
    return this;
  }

  /** Advances the face (blinks, reactions, pupils); a hidden face stands still. */
  tick(dtMs: number): void {
    if (this.face.visible) this.face.tick(dtMs);
  }

  /** Sets the scale to `from` (after `delayMs`) and tweens it back to 1. */
  private springBack(
    target: Phaser.GameObjects.Container,
    from: ScaleStart,
    durationMs: number,
    ease: string,
    delayMs: number,
  ): void {
    this.scene.tweens.killTweensOf(target);
    const props: Record<string, { from: number; to: number }> = {};
    for (const key of ['scaleX', 'scaleY'] as const) {
      const start = from[key];
      if (start !== undefined) props[key] = { from: start, to: 1 };
    }
    if (delayMs <= 0) target.setScale(from.scaleX ?? 1, from.scaleY ?? 1);
    else target.setScale(1);
    this.scene.tweens.add({
      targets: target,
      ...props,
      duration: durationMs,
      ease,
      delay: delayMs,
    });
  }
}

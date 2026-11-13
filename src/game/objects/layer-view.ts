import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { LayerPlan } from '../../core/sim-types';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { faceRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { createGlossBand, sweepGloss } from '../fx/gloss-sweep';
import { creatureColors } from './creature-art/primitives';
import { LayerFace } from './layer-face';
import { LayerRig } from './layer-rig';
import {
  acquireLayerArt,
  artAlpha,
  artOriginY,
  artWidth,
  colorIndexFor,
  releaseLayerArt,
} from './layer-art';

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
  /** Extra animations for the abilities: flash, hop, fade, split. */
  readonly rig: LayerRig;
  /** Sideways offset the tower adds to the position (a spring landing slides in from it). */
  slideX = 0;
  private artKey: string | null = null;
  private drawnColor = -1;
  private drawnWidth = -1;
  private drawnCut: CutSide | null = null;
  private drawnCreature: CreatureId | null = null;
  private faceEnabled = true;
  private readonly lookPlan: LayerPlan = { kind: 'plain' };

  constructor(scene: Phaser.Scene) {
    super(scene);
    const half = BALANCE.layer.height / 2;
    this.art = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
    this.glossSweep = createGlossBand(scene, BALANCE.layer.height - ANIM.layer.outline * 2);
    this.face = new LayerFace(scene);
    this.rig = new LayerRig(scene, this.art, this.face);
    this.content = new Phaser.GameObjects.Container(scene, 0, -half, [
      this.art,
      ...this.rig.parts,
      this.glossSweep,
      this.face,
    ]);
    this.squashRoot = new Phaser.GameObjects.Container(scene, 0, half, [this.content]);
    this.rig.attach(this.content, this.squashRoot);
    this.add(this.squashRoot);
    scene.add.existing(this);
  }

  /** What the layer is (plain, creature, golden); the picture of a creature layer is drawn from it. */
  get look(): Readonly<LayerPlan> {
    return this.lookPlan;
  }

  /**
   * Tells the view what kind of layer it shows; call it before `setLayer`, which draws from it.
   * Cheap: it copies three fields and hands the face recipe on only when the creature changes.
   */
  setLook(plan: LayerPlan): this {
    const creature = this.creatureOf(plan);
    if (creature !== this.creatureOf(this.lookPlan)) {
      const recipe = creature ? faceRecipe(creature) : null;
      this.face.setRecipe(
        recipe,
        creature && recipe ? creatureColors(creature)[recipe.lidTint] : undefined,
      );
    }
    this.lookPlan.kind = plan.kind;
    this.lookPlan.creature = plan.creature;
    this.lookPlan.level = plan.level;
    return this;
  }

  /** The face of this layer: mood, reactions, look target. */
  get faceView(): LayerFace {
    return this.face;
  }

  /**
   * Shows the baked art for the colour (or the creature of `look`), width and cut side
   * (`null`: intact layer) and lays the face out for the width. Baking happens only for a
   * new combination.
   */
  setLayer(index: number, width: number, cut: CutSide | null = null): this {
    const color = colorIndexFor(index);
    const w = artWidth(width);
    const creature = this.creatureOf(this.lookPlan);
    if (
      color === this.drawnColor &&
      w === this.drawnWidth &&
      cut === this.drawnCut &&
      creature === this.drawnCreature
    ) {
      return this;
    }
    const key = acquireLayerArt(this.scene, color, w, cut, creature);
    if (this.artKey) releaseLayerArt(this.scene, this.artKey);
    this.artKey = key;
    this.drawnColor = color;
    this.drawnWidth = w;
    this.drawnCut = cut;
    this.drawnCreature = creature;
    this.art.setTexture(key).setOrigin(0.5, artOriginY(creature)).setAlpha(artAlpha(creature));
    this.art.setVisible(true);
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
    this.drawnCreature = null;
    this.art.setVisible(false);
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.releaseArt();
    super.destroy(fromScene);
  }

  private creatureOf(plan: Readonly<LayerPlan>): CreatureId | null {
    return plan.kind === 'creature' && plan.creature ? plan.creature : null;
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
    durationMs: number = ANIM.land.durationMs,
  ): void {
    this.springBack(this.squashRoot, { scaleX, scaleY }, durationMs, ANIM.land.ease, delayMs);
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
    sweepGloss(this.glossSweep, travel, glossSweepMs, glossSweepAlpha);
  }

  /** The layer slides in from `fromX` pixels off its place and settles with a spring. */
  playSlide(fromX: number, durationMs: number, ease: string): void {
    this.scene.tweens.killTweensOf(this);
    this.slideX = fromX;
    this.scene.tweens.add({ targets: this, slideX: 0, duration: durationMs, ease });
  }

  /** Stops every animation of this layer and restores its shape, for reuse from a pool. */
  resetAnim(): this {
    this.scene.tweens.killTweensOf([this, this.squashRoot, this.content, this.glossSweep]);
    this.rig.reset();
    this.slideX = 0;
    this.setScale(1).setAngle(0).setAlpha(1);
    this.squashRoot.setScale(1);
    this.content.setScale(1);
    this.glossSweep.setVisible(false);
    this.face.reset();
    return this;
  }

  /** Advances the face (blinks, reactions, pupils); a hidden face stands still. */
  tick(dtMs: number): void {
    this.rig.apply();
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

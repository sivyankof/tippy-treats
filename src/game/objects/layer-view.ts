import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { LayerPlan } from '../../core/sim-types';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { ABILITY_ANIM } from '../../data/ability-anim';
import { faceRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { IDLE_MOTION } from '../../data/idle-motion';
import { effectsMode } from '../effects-mode';
import { createGlossBand, sweepGloss } from '../fx/gloss-sweep';
import { idlePose, type IdlePose } from '../ui/idle-motion';
import { creatureColors } from './creature-art/primitives';
import { LayerFace } from './layer-face';
import { LayerMaterial, type MaterialMotion } from './layer-material';
import { LayerRig } from './layer-rig';
import {
  acquireLayerArt,
  artAlpha,
  artOriginY,
  artWidth,
  colorIndexFor,
  GOLDEN_COLOR_INDEX,
  releaseLayerArt,
} from './layer-art';

type ScaleStart = { scaleX?: number; scaleY?: number };

/**
 * One cake layer: a baked picture (shadow, body, glaze, gloss) and a face on top.
 *
 * The container sits on the centre of the layer and carries the sway rotation.
 * Inside it, `squashRoot` is pinned to the bottom edge (squash and stretch pivot there),
 * `breathRoot` (the idle breathing) and `shapeRoot` (the material's jiggle) too, and `content`
 * to the centre of the layer (widening pivots there):
 *
 *   LayerView > squashRoot (y = +H/2) > breathRoot > shapeRoot > content (y = -H/2) > art, glossSweep, face
 */
export class LayerView extends Phaser.GameObjects.Container {
  private readonly squashRoot: Phaser.GameObjects.Container;
  /** Idle breathing of a placed layer: it only ever grows upwards, so no gap opens above it. */
  private readonly breathRoot: Phaser.GameObjects.Container;
  private readonly breath: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  private readonly content: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Image;
  private readonly glossSweep: Phaser.GameObjects.Image;
  private readonly face: LayerFace;
  /** Extra animations for the abilities: flash, hop, fade, split. */
  readonly rig: LayerRig;
  /** How the material of a creature layer lands, jiggles and rests. */
  readonly material: LayerMaterial;
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
    const shapeRoot = new Phaser.GameObjects.Container(scene, 0, 0, [this.content]);
    this.material = new LayerMaterial(shapeRoot);
    this.breathRoot = new Phaser.GameObjects.Container(scene, 0, 0, [shapeRoot]);
    this.squashRoot = new Phaser.GameObjects.Container(scene, 0, half, [this.breathRoot]);
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
      this.material.setCreature(creature);
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
    const color = this.lookPlan.kind === 'golden' ? GOLDEN_COLOR_INDEX : colorIndexFor(index);
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

  /**
   * The landing of this layer's material, or (`strength` below 1, `delayMs` later) the squash
   * wave passing through it. The top shell of the twins lags when the wave passes.
   */
  playImpact(strength = 1, delayMs = 0): void {
    const land = this.material.landing(strength);
    this.springBack(this.squashRoot, land, land.durationMs, land.ease, delayMs);
    const lag = this.material.current?.shellLag;
    if (lag && delayMs > 0 && !effectsMode.reduced) {
      const { creamColor, creamAlpha } = ABILITY_ANIM.twins;
      this.rig.lagShell({
        width: this.drawnWidth,
        liftPx: lag.liftPx * strength,
        liftMs: lag.liftMs,
        holdMs: 0,
        delayMs,
        ease: ABILITY_ANIM.rig.hopEase,
        creamColor,
        creamAlpha,
      });
    }
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
    this.material.reset();
    this.slideX = 0;
    this.setScale(1).setAngle(0).setAlpha(1);
    this.squashRoot.setScale(1);
    this.breathRoot.setScale(1);
    this.content.setScale(1);
    this.glossSweep.setVisible(false);
    this.face.reset();
    return this;
  }

  /**
   * Advances the face (blinks, reactions, pupils; a hidden face stands still) and the material.
   * Without `motion` the material stays still (a flying or falling layer).
   */
  tick(dtMs: number, motion?: MaterialMotion): void {
    this.rig.apply();
    this.material.tick(dtMs, motion);
    if (motion) this.breathe(motion);
    if (this.face.visible) this.face.tick(dtMs);
  }

  /**
   * The quiet breathing of a placed layer, whatever its material and the effects mode (ambient
   * motion stays): a hair wider and taller, never narrower or lower, so no gap opens above it.
   */
  private breathe(motion: MaterialMotion): void {
    const spec = IDLE_MOTION.layer;
    const pose = idlePose(spec, motion.timeMs, motion.phase, this.breath);
    this.breathRoot.setScale(pose.scaleX, pose.scaleY + spec.scaleY);
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

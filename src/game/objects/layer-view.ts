import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { LayerPlan } from '../../core/sim-types';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { ABILITY_ANIM } from '../../data/ability-anim';
import { faceRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import type { StageMode } from '../../data/mastery-look';
import { IDLE_MOTION } from '../../data/idle-motion';
import { effectsMode } from '../effects-mode';
import { createGlossBand, sweepGloss } from '../fx/gloss-sweep';
import { springScaleBack, type ScaleStart } from '../fx/spring-back';
import { idlePose, type IdlePose } from '../ui/idle-motion';
import { creatureColors } from './creature-art/primitives';
import type { EdgeShape } from './edge-squash';
import { EdgeSquashSkin } from './edge-squash-skin';
import { LayerFace } from './layer-face';
import { LayerShade } from './layer-shade';
import { LayerMaterial, type MaterialMotion } from './layer-material';
import { LayerRig } from './layer-rig';
import { hasNewLook } from '../../core/mastery';
import { artWidth, creatureOfLayer, creatureStage, lookCodeFor, SHADOW_ROWS } from './layer-art';
import { GrownAccentView } from './grown-accent-view';
import { LayerArtSlot } from './layer-art-slot';
import { RAINBOW_LOOK } from '../../data/rainbow-look';
import { TWO_PI } from '../../util/math';
import { RainbowIdle } from './rainbow-idle';
import { GlazeDripLayer } from './glaze-drip-layer';
import { LayerTopper, type TopperWorld } from './layer-topper';
import { LayerMarkPictures } from './layer-marks';
import { pressAngle, pressDrop, pressPivot, pressShift } from './layer-press';

/** A heavy press at one spot of a layer (it landed on the guest of the tower). */
export interface PressSpec {
  /** The squash it starts from, held for `holdMs`, then springing back over `settleMs`. */
  scaleX: number;
  scaleY: number;
  holdMs: number;
  settleMs: number;
  squashEase: string;
  /** How far the pressed spot dips, and how the dip eases back. */
  dipPx: number;
  dipEase: string;
  /** Only the dip: the layer keeps the squash it has (a landing squash that is still running). */
  dipOnly?: boolean;
}

/**
 * One cake layer: a baked picture (shadow, body, glaze, gloss) and a face on top.
 *
 * The container sits on the centre of the layer and carries the sway rotation.
 * Inside it, `squashRoot` is pinned to the bottom edge (squash and stretch pivot there),
 * `breathRoot` (the idle breathing) and `shapeRoot` (the material's jiggle) too, and `content`
 * to the centre of the layer (widening pivots there):
 *
 *   LayerView > squashRoot (y = +H/2) > breathRoot > shapeRoot > content (y = -H/2) > art, glazeDrips, glossSweep, face
 *
 * A flying layer squashed against the screen edge shows its art through `EdgeSquashSkin`
 * (made on first use and put right above the art) instead of the plain art image.
 */
export class LayerView extends Phaser.GameObjects.Container {
  private readonly squashRoot: Phaser.GameObjects.Container;
  /** Idle breathing of a placed layer: it only ever grows upwards, so no gap opens above it. */
  private readonly breathRoot: Phaser.GameObjects.Container;
  private readonly breath: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  private readonly shapeRoot: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  /** The art squashed against the screen edge; made the first time a squash is asked for. */
  private edgeSkin: EdgeSquashSkin | null = null;
  private readonly art: Phaser.GameObjects.Image;
  private readonly artSlot: LayerArtSlot;
  /** Glaze drips that keep growing after the layer has landed, drawn over the baked ones. */
  readonly glazeDrips: GlazeDripLayer;
  private readonly glossSweep: Phaser.GameObjects.Image;
  private readonly face: LayerFace;
  /** The shade of the layer above, laid along the top of this one. */
  private readonly shade: LayerShade;
  /** The big topper on the top edge of a plain layer. */
  private readonly topper: LayerTopper;
  /** Marks the layer keeps until the end of the run: a glaze drop on a cut, a juice stain, a cream roll. */
  private readonly marks: LayerMarkPictures;
  /** The star and the rest wave of the Rainbow layer. */
  private readonly rainbow: RainbowIdle;
  /** The one small moving sprite of a grown creature (bee, breath, spark). */
  private readonly accent: GrownAccentView;
  /** Which picture stage the layer asks for: always usual, always grown, or by the creature level. */
  private stageMode: StageMode = 'base';
  /** The creature and look whose face and material are set now. */
  private styledCreature: CreatureId | null = null;
  private styledGrown = false;
  /** Extra animations for the abilities: flash, hop, fade, split. */
  readonly rig: LayerRig;
  /** How the material of a creature layer lands, jiggles and rests. */
  readonly material: LayerMaterial;
  /** Sideways offset the tower adds to the position (a spring landing slides in from it). */
  slideX = 0;
  private faceEnabled = true;
  private readonly lookPlan: LayerPlan = { kind: 'plain' };
  /** The tilt of a press (radians) around the bottom corner on `side` (1 right, -1 left). */
  private readonly press = { angle: 0, side: 1 as -1 | 1 };
  private readonly pressOffset = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    super(scene);
    const half = BALANCE.layer.height / 2;
    this.art = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
    this.artSlot = new LayerArtSlot(scene, this.art);
    this.glazeDrips = new GlazeDripLayer(scene);
    this.glossSweep = createGlossBand(scene, BALANCE.layer.height - ANIM.layer.outline * 2);
    this.face = new LayerFace(scene);
    this.shade = new LayerShade(scene);
    this.topper = new LayerTopper(scene);
    this.marks = new LayerMarkPictures(scene);
    this.accent = new GrownAccentView(scene);
    this.rig = new LayerRig(scene, this.art, this.face);
    this.content = new Phaser.GameObjects.Container(scene, 0, -half, [
      this.art,
      this.glazeDrips,
      ...this.marks.images,
      ...this.shade.parts,
      ...this.rig.parts,
      this.glossSweep,
      this.face,
      this.topper.image,
      this.accent.image,
    ]);
    this.rainbow = new RainbowIdle(scene, this.content, this.art);
    this.shapeRoot = new Phaser.GameObjects.Container(scene, 0, 0, [this.content]);
    this.material = new LayerMaterial(this.shapeRoot);
    this.breathRoot = new Phaser.GameObjects.Container(scene, 0, 0, [this.shapeRoot]);
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
    const creature = creatureOfLayer(plan);
    const grown = creature !== null && this.isGrown(plan.level);
    if (creature !== this.styledCreature || grown !== this.styledGrown) {
      const recipe = creature ? faceRecipe(creature, grown) : null;
      this.face.setRecipe(
        recipe,
        creature && recipe ? creatureColors(creature)[recipe.lidTint] : undefined,
      );
      this.material.setCreature(creature, grown);
      this.styledCreature = creature;
      this.styledGrown = grown;
    }
    this.lookPlan.kind = plan.kind;
    this.lookPlan.creature = plan.creature;
    this.lookPlan.level = plan.level;
    return this;
  }

  /**
   * Which picture a creature layer shows: `base` (the default) always the usual one, `grown` always
   * the grown look, `level` the grown look from `MASTERY.lookLevel` (the run). Call it before `setLook`.
   */
  setStageMode(mode: StageMode): this {
    if (mode === this.stageMode) return this;
    this.stageMode = mode;
    return this.setLook(this.lookPlan);
  }

  private isGrown(level: number | undefined): boolean {
    return this.stageMode === 'grown' || (this.stageMode === 'level' && hasNewLook(level ?? 0));
  }

  /** Width the picture was baked for; -1 while it shows none. */
  get drawnWidth(): number {
    return this.artSlot.drawnWidth;
  }

  /** Bitten edge of the picture shown (`null`: intact). */
  get cutSide(): CutSide | null {
    return this.artSlot.drawnCut;
  }

  /** The face of this layer: mood, reactions, look target. */
  get faceView(): LayerFace {
    return this.face;
  }

  /**
   * Shows the baked art for the plain look of layer `index` (1-based; or the creature of `look`),
   * width and cut side (`null`: intact layer) and lays the face out for the width. A view with
   * its face off (a bitten-off piece) gets the faceless picture. Baking happens only for a new
   * combination.
   */
  setLayer(index: number, width: number, cut: CutSide | null = null): this {
    const look = lookCodeFor(index, this.lookPlan.kind === 'golden');
    const w = artWidth(width);
    this.topper.setFaceless(!this.faceEnabled);
    this.topper.update(index, w, this.lookPlan.kind === 'plain');
    this.marks.update(index);
    const creature = creatureOfLayer(this.lookPlan);
    const grown = creature !== null && this.isGrown(this.lookPlan.level);
    const stage = creatureStage(creature, grown, index);
    if (!this.artSlot.show(look, w, cut, creature, !this.faceEnabled, stage)) return this;
    this.rainbow.set(creature === 'rainbow', w, grown);
    this.accent.set(grown ? creature : null, w);
    this.face.layout(w);
    this.face.setVisible(this.faceEnabled);
    return this;
  }

  /** Lays the shade of the layer above (centre `upperX`, width `upperW`; this one is at `x`, `width`), or none for `null`. */
  setShadeFrom(upper: { x: number; width: number } | null, x: number, width: number): this {
    if (upper) this.shade.set(x, width, upper.x, upper.width);
    else this.shade.clear();
    return this;
  }

  /** Lets the view show the big topper of its plain layer (a flying layer, the top layer of the tower). */
  setTopperAllowed(on: boolean): this {
    this.topper.setAllowed(on);
    return this;
  }

  /** Lets the view show the marks its layer keeps (a layer of the tower, or one of it falling in the collapse). */
  setMarksAllowed(on: boolean): this {
    this.marks.setAllowed(on);
    return this;
  }

  /** Lets a Rainbow layer tell its star joke over the layer above (a layer of the tower in the run only). */
  setJokeAllowed(on: boolean): this {
    this.rainbow.setJokeAllowed(on);
    return this;
  }

  /** The topper takes a crouch under the flying layer above: its scale is `x`, `y` times its own. */
  crouchTopper(x: number, y: number): this {
    this.topper.setCrouch(x, y);
    return this;
  }

  /** The topper stands `dx` from the centre from now on (`null`: it is gone). */
  carryTopper(dx: number | null): this {
    this.topper.setCarry(dx);
    return this;
  }

  /** The side of the face the shown topper stands on, or `null` while the layer shows none. */
  topperSide(): -1 | 1 | null {
    return this.topper.side();
  }

  /** The topper in the world as it is now, or `null` while the layer shows none. */
  topperWorld(out: TopperWorld): TopperWorld | null {
    return this.topper.world(out);
  }

  /** Draws the art fully opaque (a see-through creature baked into an icon keeps its face parts opaque too). */
  setArtOpaque(): this {
    this.art.setAlpha(1);
    return this;
  }

  /** Gives the baked art back so a pooled view does not keep its texture alive; `setLayer` brings it back. */
  releaseArt(): this {
    this.rainbow.endJoke();
    this.accent.hide();
    this.artSlot.release();
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.releaseArt();
    super.destroy(fromScene);
  }

  /** Pieces that fall off the tower have no face. */
  /** The face looks at the world point (wx, wy) for `ms`. */
  glanceAtWorld(wx: number, wy: number, ms: number): void {
    const face = this.faceView;
    const scale = face.faceScale || 1;
    face.glanceAt((wx - this.x - face.x) / scale, (wy - this.y - face.y) / scale, ms);
  }

  setFaceEnabled(enabled: boolean): this {
    this.faceEnabled = enabled;
    this.face.setVisible(enabled && this.artSlot.drawnWidth > 0);
    return this;
  }

  /** Drops the baked shadow under the layer: a piece in the air carries none (cuts the rows that hold only it). */
  dropShadow(): this {
    const frame = this.art.frame;
    this.art.setCrop(0, 0, frame.width, frame.height - SHADOW_ROWS);
    return this;
  }

  /** Moves the face sideways inside the layer (local px); 0 puts it back in the middle. */
  setFaceShift(dx: number): this {
    this.face.setX(dx);
    return this;
  }

  /** Scale of the part pinned to the bottom edge: landing, falling and sneezing. */
  setSquash(scaleX: number, scaleY: number): this {
    this.squashRoot.setScale(scaleX, scaleY);
    return this;
  }

  /** Horizontal scale the inner containers give the picture, on top of the view's own scale. */
  get innerScaleX(): number {
    return (
      this.squashRoot.scaleX * this.breathRoot.scaleX * this.shapeRoot.scaleX * this.content.scaleX
    );
  }

  /**
   * Draws the picture squashed against the screen edge (`edge-squash.ts`; offsets in the view's
   * own units), or as it is for `null`. Only the drawing changes, never the layer's place.
   */
  setEdgeSquash(shape: Readonly<EdgeShape> | null): this {
    this.rainbow.setHidden(shape !== null);
    this.topper.setEdgeHidden(shape !== null);
    if (!shape) {
      this.edgeSkin?.clear();
      return this;
    }
    if (!this.edgeSkin) {
      this.edgeSkin = new EdgeSquashSkin(this.scene, this.art, this.face, this.glossSweep);
      this.content.addAt(this.edgeSkin.parts, this.content.getIndex(this.art) + 1);
    }
    this.edgeSkin.apply(shape, this.innerScaleX);
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
        width: this.artSlot.drawnWidth,
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

  /**
   * A heavy press at `dx` from the centre: a deeper squash held for a moment (a hitstop of the
   * picture only), and a dip at that spot as the layer tilts around its far bottom corner; both
   * settle back. Only the drawing moves, never the layer's place.
   */
  playPress(dx: number, spec: PressSpec): void {
    const { scaleX, scaleY, holdMs, settleMs, squashEase, dipPx, dipEase } = spec;
    if (!spec.dipOnly) {
      springScaleBack(
        this.scene,
        this.squashRoot,
        { scaleX, scaleY },
        settleMs,
        squashEase,
        0,
        holdMs,
      );
    }
    const half = (Math.max(0, this.artSlot.drawnWidth) / 2) * scaleX;
    this.press.side = pressPivot(dx, half) < 0 ? -1 : 1;
    this.press.angle = pressAngle(dx * scaleX, half, dipPx);
    this.scene.tweens.killTweensOf(this.press);
    this.scene.tweens.add({
      targets: this.press,
      angle: 0,
      duration: settleMs,
      ease: dipEase,
      delay: holdMs,
    });
  }

  /** How far the bottom edge at `dx` from the centre is pushed down by a press now, pixels. */
  pressDropAt(dx: number): number {
    if (this.press.angle === 0) return 0;
    const sx = this.squashRoot.scaleX;
    return pressDrop(dx * sx, this.pressCorner(), this.press.angle);
  }

  /** The bottom corner a press tilts around, pixels from the bottom centre at the current squash. */
  private pressCorner(): number {
    return (this.press.side * Math.max(0, this.artSlot.drawnWidth) * this.squashRoot.scaleX) / 2;
  }

  /** Puts the tilt of a press onto the part pinned to the bottom edge (after the rig placed it). */
  private applyPress(): void {
    const angle = this.press.angle;
    const shift = pressShift(this.pressCorner(), angle, this.pressOffset);
    this.squashRoot.setRotation(angle);
    this.squashRoot.setX(shift.x);
    if (angle !== 0) this.squashRoot.y += shift.y;
  }

  /** Quick vertical squash (a sneeze) that springs back. */
  playSqueeze(scaleY: number, durationMs: number): void {
    this.springBack(this.squashRoot, { scaleY }, durationMs, ANIM.sneeze.ease, 0);
  }

  /** The layer was `fromWidth` wide a moment ago: it puffs up from there to its width. */
  playWiden(fromWidth: number): void {
    if (this.artSlot.drawnWidth <= 0) return;
    this.springBack(
      this.content,
      { scaleX: fromWidth / this.artSlot.drawnWidth },
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
  playGlossSweep(
    ms: number = ANIM.perfect.glossSweepMs,
    alpha: number = ANIM.perfect.glossSweepAlpha,
  ): void {
    const { outline } = ANIM.layer;
    const travel = this.artSlot.drawnWidth / 2 - outline - ANIM.perfect.glossSweepWidth / 2;
    sweepGloss(this.glossSweep, travel, ms, alpha);
  }

  /** The layer slides in from `fromX` pixels off its place and settles with a spring. */
  playSlide(fromX: number, durationMs: number, ease: string): void {
    this.scene.tweens.killTweensOf(this);
    this.slideX = fromX;
    this.scene.tweens.add({ targets: this, slideX: 0, duration: durationMs, ease });
  }

  /** Stops every animation of this layer and restores its shape, for reuse from a pool. */
  resetAnim(): this {
    this.scene.tweens.killTweensOf([
      this,
      this.squashRoot,
      this.content,
      this.glossSweep,
      this.press,
    ]);
    this.press.angle = 0;
    this.art.setCrop();
    this.face.setX(0);
    this.squashRoot.setRotation(0).setX(0);
    this.edgeSkin?.clear();
    this.rig.reset();
    this.material.reset();
    this.slideX = 0;
    this.setScale(1).setAngle(0).setAlpha(1);
    this.squashRoot.setScale(1);
    this.breathRoot.setScale(1);
    this.content.setScale(1);
    this.glossSweep.setVisible(false);
    this.glazeDrips.clear();
    this.shade.clear();
    this.rainbow.setJokeAllowed(false);
    this.face.reset();
    this.topper.reset();
    this.marks.reset();
    return this;
  }

  /**
   * Advances the face (blinks, reactions, pupils; a hidden face stands still) and the material.
   * Without `motion` the material stays still (a flying or falling layer). True when the Rainbow
   * star has just started its joke.
   */
  tick(dtMs: number, motion?: MaterialMotion): boolean {
    this.rig.apply();
    this.applyPress();
    this.glazeDrips.setAlpha(this.art.alpha);
    this.marks.tick(this.scene.time.now, this.art.alpha);
    this.material.tick(dtMs, motion);
    if (motion) this.breathe(motion);
    if (this.face.visible) this.face.tick(dtMs);
    const phaseMs = ((motion?.phase ?? 0) / TWO_PI) * RAINBOW_LOOK.idle.waveEveryMs;
    this.rainbow.draw(this.scene.time.now, phaseMs, true);
    this.accent.tick(this.scene.time.now, phaseMs);
    if (!this.rainbow.takeSquint()) return false;
    this.face.react('squint', RAINBOW_LOOK.idle.joke.squintMs);
    return true;
  }

  /** The star of the Rainbow layer in world pixels. */
  starWorld(): { x: number; y: number } {
    return this.rainbow.starWorld();
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

  private springBack(
    target: Phaser.GameObjects.Container,
    from: ScaleStart,
    durationMs: number,
    ease: string,
    delayMs: number,
  ): void {
    springScaleBack(this.scene, target, from, durationMs, ease, delayMs);
  }
}

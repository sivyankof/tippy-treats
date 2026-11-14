import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import type { FaceRecipe } from '../../data/creature-looks';
import { LICK } from '../../data/lick';
import { frameLerp } from '../../util/math';
import { FaceParts } from './face-parts';
import { faceLayout } from './face-recipe';
import { FaceLick } from './face-lick';
import type { LickFrame, LickKind, LickScene, LoopShape } from './lick-plan';
import type { LickStyle } from '../../data/lick';
import {
  FaceState,
  resolveExpression,
  type Expression,
  type Mood,
  type MouthKind,
  type Reaction,
} from './face-state';

function sameExpression(a: Expression | null, b: Expression): boolean {
  return (
    a !== null &&
    a.eyes === b.eyes &&
    a.mouth === b.mouth &&
    a.brows === b.brows &&
    a.ownBrows === b.ownBrows &&
    a.lids === b.lids &&
    a.sweat === b.sweat &&
    a.puffed === b.puffed
  );
}

/**
 * The face of a cake layer: eyes with pupils, brows, mouth, cheeks and a sweat drop. A creature
 * layer gets its own recipe (brow pose, resting mouth, eyelids, blush); twins show two small faces.
 * Everything is driven from state and `tick`, there are no tweens to clean up.
 */
export class LayerFace extends Phaser.GameObjects.Container {
  private readonly timers = new FaceState(Math.random);
  /** The main face, and the second one of a pair (created when a pair recipe first arrives). */
  private readonly mainFace: FaceParts;
  private pairFace: FaceParts | null = null;

  private recipe: FaceRecipe | null = null;
  private lidColor = 0xffffff;
  private mood: Mood = 'calm';
  private mouthHint: MouthKind | undefined;
  private expression: Expression | null = null;
  /** Inputs the current expression was resolved from. */
  private resolvedReaction: Reaction | null = null;
  private resolvedMood: Mood = 'calm';
  private resolvedHint: MouthKind | undefined;
  private layerWidth = 0;
  /** The layer is wide enough for mouth, cheeks and sweat (eyes, pupils and brows always show). */
  private showRest = true;
  /** Pupil offset the pupils glide to, and the one they show now (face pixels). */
  private targetX = 0;
  private targetY = 0;
  private lookX = 0;
  private lookY = 0;
  private driftX = 0;
  /** The two faces of a pair rise by this much (the top shell of the twins lifting). */
  private pairLift = 0;
  /** The lick played on this face, a glance at a neighbour's, an envious lick of the lips. */
  private readonly lick: FaceLick;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, ANIM.face.centerY);
    this.mainFace = new FaceParts(scene);
    this.add(this.mainFace);
    this.lick = new FaceLick({
      parts: this.mainFace,
      container: this,
      reaction: () => this.timers.reaction(),
      react: (reaction, ms) => this.timers.react(reaction, ms),
      clearReaction: () => this.timers.clearReaction(),
      lookFull: (dx, dy) => this.lookFull(dx, dy),
      restore: () => this.restore(),
      showRest: () => this.showRest,
    });
    this.refresh();
    this.placePupils();
  }

  /**
   * Gives the face the look of a creature (`null`: the plain face). `lidColor` is the colour of
   * its eyelids. Call `layout` again after a change.
   */
  setRecipe(recipe: FaceRecipe | null, lidColor = 0xffffff): this {
    if (recipe === this.recipe && lidColor === this.lidColor) return this;
    this.recipe = recipe;
    this.lidColor = lidColor;
    this.expression = null;
    this.setY(ANIM.face.centerY + (recipe?.offsetY ?? 0));
    if (recipe?.pair && !this.pairFace) {
      this.pairFace = new FaceParts(this.scene);
      this.add(this.pairFace);
    }
    this.pairFace?.setVisible(recipe?.pair != null);
    this.layout(this.layerWidth);
    return this.refresh();
  }

  /** Scales the face down on narrow layers; the narrowest keep only eyes, pupils and brows. */
  layout(width: number): this {
    this.layerWidth = width;
    const { scale, showRest } = faceLayout(width, this.recipe);
    this.setScale(scale);
    this.showRest = showRest;
    this.placeFaces();
    this.applyExpression();
    this.placePupils();
    return this;
  }

  /** The faces of a pair move `dy` pixels up together; no effect on a single face. */
  setPairLift(dy: number): this {
    if (dy === this.pairLift) return this;
    this.pairLift = dy;
    this.placeFaces();
    return this;
  }

  private placeFaces(): void {
    const pair = this.recipe?.pair;
    if (pair) {
      this.mainFace.setPosition(-pair.spread, -this.pairLift).setScale(pair.scale);
      this.mainFace.setGaze(pair.gaze);
      this.pairFace?.setPosition(pair.spread, -this.pairLift).setScale(pair.scale);
      this.pairFace?.setGaze(-pair.gaze);
    } else {
      this.mainFace.setPosition(0, 0).setScale(1);
      this.mainFace.setGaze(0);
    }
  }

  setMood(mood: Mood): this {
    this.mood = mood;
    return this.refresh();
  }

  setMouthHint(mouth: MouthKind | undefined): this {
    this.mouthHint = mouth;
    return this.refresh();
  }

  /** Starts a timed reaction; a stronger one already running is not replaced. */
  react(reaction: Reaction, ms: number): this {
    this.timers.react(reaction, ms);
    return this.refresh();
  }

  clearReaction(): this {
    this.timers.clearReaction();
    return this.refresh();
  }

  /**
   * Look target in face-local pixels: the pupils glide towards it (`snap` jumps at once).
   * The farther the target, the farther the pupils move, up to the full offset.
   */
  lookAt(dx: number, dy: number, snap = false): this {
    // A licking face keeps its eyes on the drop, a glancing one on the neighbour.
    if (this.lick.busy) return this;
    return this.aim(dx, dy, snap);
  }

  private aim(dx: number, dy: number, snap = false): this {
    const { pupilMaxOffset, lookRange } = ANIM.face;
    const length = Math.hypot(dx, dy);
    const reach = length === 0 ? 0 : (Math.min(length / lookRange, 1) * pupilMaxOffset) / length;
    this.targetX = dx * reach;
    this.targetY = dy * reach;
    if (snap) {
      this.lookX = this.targetX;
      this.lookY = this.targetY;
      this.placePupils();
    }
    return this;
  }

  /** The pupils go all the way towards (dx, dy), however near it is. */
  private lookFull(dx: number, dy: number): void {
    const length = Math.hypot(dx, dy) || 1;
    const range = ANIM.face.lookRange / length;
    this.aim(dx * range, dy * range);
  }

  /** Back to the plain expression and layout, under the pose of a lick. */
  private restore(): void {
    this.expression = null;
    this.refresh();
    this.placeFaces();
    this.placePupils();
  }

  /** A single face with a mouth, big enough and not busy: it may lick. */
  get canLick(): boolean {
    const busy = this.timers.reaction();
    return (
      this.visible &&
      !this.recipe?.pair &&
      this.showRest &&
      this.scaleX >= LICK.minFaceScale &&
      !this.lick.busy &&
      (busy === null || busy === 'blink')
    );
  }

  get licking(): boolean {
    return this.lick.active;
  }

  /** The current moment of the lick running. */
  get lickFrameNow(): Readonly<LickFrame> {
    return this.lick.frameNow;
  }

  /** The points of the tongue (face pixels) while it is out, else `null`. */
  get tonguePoints(): readonly number[] | null {
    return this.lick.tonguePoints;
  }

  /** Face scale (the layer width scales the face down). */
  get faceScale(): number {
    return this.scaleX;
  }

  /** Starts a lick (docs/06, "Слизывание глазури"). */
  startLick(scene: LickScene, kind: LickKind, shape: LoopShape, style: LickStyle): void {
    this.lick.start(scene, kind, shape, style);
    this.refresh();
  }

  /** Glances at (`dx`, `dy`) (face pixels) for `ms`, whatever the look target is meanwhile. */
  glanceAt(dx: number, dy: number, ms: number): void {
    this.lick.glance(dx, dy, ms);
  }

  /** Licks its lips enviously (a neighbour is licking). */
  lickLipsEnviously(side: 1 | -1): void {
    this.lick.envy(side);
    this.refresh();
  }

  /** Stops the lick at once (the tower got worried, the view was recycled). */
  cancelLick(): void {
    this.lick.cancel();
  }

  /** Extra pupil offset in face pixels (nervous eyes trailing the sway). */
  setPupilDrift(dx: number): this {
    this.driftX = dx;
    this.placePupils();
    return this;
  }

  /** Advances blinking and reactions, the pupils and the sweat drop. */
  tick(dtMs: number): void {
    this.timers.update(dtMs);
    this.refresh();
    // Last, so the pose of the lick lies over the expression of this frame.
    this.lick.tick(dtMs);
    const follow = frameLerp(ANIM.face.lookLerp, dtMs);
    this.lookX += (this.targetX - this.lookX) * follow;
    this.lookY += (this.targetY - this.lookY) * follow;
    this.placePupils();
    this.mainFace.animateSweat(dtMs);
    this.pairFace?.animateSweat(dtMs);
  }

  /** Back to a calm face with open eyes, centred pupils and a fresh blink timer. */
  reset(): this {
    this.timers.reset();
    this.lick.reset();
    this.mood = 'calm';
    this.mouthHint = undefined;
    this.targetX = this.targetY = this.lookX = this.lookY = this.driftX = 0;
    this.setPairLift(0);
    this.mainFace.resetSweat();
    this.pairFace?.resetSweat();
    this.expression = null;
    this.refresh();
    this.placePupils();
    return this;
  }

  /** Re-resolves the expression, but only when mood, reaction or mouth hint changed (no per-frame garbage). */
  private refresh(): this {
    const reaction = this.timers.reaction();
    if (
      this.expression !== null &&
      reaction === this.resolvedReaction &&
      this.mood === this.resolvedMood &&
      this.mouthHint === this.resolvedHint
    ) {
      return this;
    }
    this.resolvedReaction = reaction;
    this.resolvedMood = this.mood;
    this.resolvedHint = this.mouthHint;
    const next = resolveExpression(this.mood, reaction, this.mouthHint, this.recipe);
    if (sameExpression(this.expression, next)) return this;
    this.expression = next;
    this.applyExpression();
    return this;
  }

  /** Pushes the current expression and layout onto the parts. */
  private applyExpression(): void {
    const e = this.expression;
    if (!e) return;
    const ctx = { recipe: this.recipe, lidColor: this.lidColor, showRest: this.showRest };
    this.mainFace.apply(e, ctx);
    if (this.recipe?.pair) this.pairFace?.apply(e, ctx);
  }

  private placePupils(): void {
    const x = this.lookX + this.driftX;
    this.mainFace.placePupils(x, this.lookY);
    this.pairFace?.placePupils(x, this.lookY);
  }
}

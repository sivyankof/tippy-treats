import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { frameLerp } from '../../util/math';
import {
  FaceState,
  resolveExpression,
  type Expression,
  type Mood,
  type MouthKind,
  type Reaction,
} from './face-state';
import { EYE_TEXTURE, FACE_TEXTURES, MOUTH_TEXTURE } from './face-textures';

function sameExpression(a: Expression | null, b: Expression): boolean {
  return (
    a !== null &&
    a.eyes === b.eyes &&
    a.mouth === b.mouth &&
    a.brows === b.brows &&
    a.sweat === b.sweat
  );
}

/**
 * The face of a cake layer: eyes with pupils, brows, mouth, cheeks and a sweat drop.
 * Everything is driven from state and `tick`, there are no tweens to clean up.
 */
export class LayerFace extends Phaser.GameObjects.Container {
  private readonly timers = new FaceState(Math.random);
  private readonly cheekL: Phaser.GameObjects.Image;
  private readonly cheekR: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly eyeL: Phaser.GameObjects.Image;
  private readonly eyeR: Phaser.GameObjects.Image;
  private readonly pupilL: Phaser.GameObjects.Image;
  private readonly pupilR: Phaser.GameObjects.Image;
  private readonly browL: Phaser.GameObjects.Image;
  private readonly browR: Phaser.GameObjects.Image;
  private readonly sweat: Phaser.GameObjects.Image;

  private mood: Mood = 'calm';
  private mouthHint: MouthKind | undefined;
  private expression: Expression | null = null;
  /** Inputs the current expression was resolved from. */
  private resolvedReaction: Reaction | null = null;
  private resolvedMood: Mood = 'calm';
  private resolvedHint: MouthKind | undefined;
  /** The layer is wide enough for mouth, cheeks and sweat (eyes, pupils and brows always show). */
  private showRest = true;
  /** Pupil offset the pupils glide to, and the one they show now (face pixels). */
  private targetX = 0;
  private targetY = 0;
  private lookX = 0;
  private lookY = 0;
  private driftX = 0;
  private sweatMs = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, ANIM.face.centerY);
    const { eyeSpacing, mouthOffsetY, cheekOffsetY, cheekSpacing, browOffsetY, browRaiseDeg } =
      ANIM.face;
    const half = eyeSpacing / 2;
    const image = (key: string, x: number, y: number): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, x, y, key);

    this.cheekL = image(FACE_TEXTURES.cheek, -cheekSpacing / 2, cheekOffsetY);
    this.cheekR = image(FACE_TEXTURES.cheek, cheekSpacing / 2, cheekOffsetY);
    this.mouth = image(FACE_TEXTURES.mouthSmile, 0, mouthOffsetY);
    this.eyeL = image(FACE_TEXTURES.eyeOpen, -half, 0);
    this.eyeR = image(FACE_TEXTURES.eyeOpen, half, 0);
    this.pupilL = image(FACE_TEXTURES.pupil, -half, 0);
    this.pupilR = image(FACE_TEXTURES.pupil, half, 0);
    // Inner ends go up: the left brow turns counter-clockwise, the right one clockwise.
    this.browL = image(FACE_TEXTURES.brow, -half, browOffsetY).setAngle(-browRaiseDeg);
    this.browR = image(FACE_TEXTURES.brow, half, browOffsetY).setAngle(browRaiseDeg);
    this.sweat = image(FACE_TEXTURES.sweat, ANIM.face.sweatX, ANIM.face.sweatY);

    this.add([
      this.cheekL,
      this.cheekR,
      this.mouth,
      this.eyeL,
      this.eyeR,
      this.pupilL,
      this.pupilR,
      this.browL,
      this.browR,
      this.sweat,
    ]);
    this.refresh();
    this.placePupils();
  }

  /** Scales the face down on narrow layers; the narrowest keep only eyes, pupils and brows. */
  layout(width: number): this {
    const { fullWidth, eyesOnlyWidth } = ANIM.face;
    this.setScale(Math.min(1, width / fullWidth));
    this.showRest = width >= eyesOnlyWidth;
    this.applyExpression();
    return this;
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
    const follow = frameLerp(ANIM.face.lookLerp, dtMs);
    this.lookX += (this.targetX - this.lookX) * follow;
    this.lookY += (this.targetY - this.lookY) * follow;
    this.placePupils();
    this.animateSweat(dtMs);
  }

  /** Back to a calm face with open eyes, centred pupils and a fresh blink timer. */
  reset(): this {
    this.timers.reset();
    this.mood = 'calm';
    this.mouthHint = undefined;
    this.targetX = this.targetY = this.lookX = this.lookY = this.driftX = 0;
    this.sweatMs = 0;
    this.sweat.setPosition(ANIM.face.sweatX, ANIM.face.sweatY).setAlpha(1);
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
    const next = resolveExpression(this.mood, reaction, this.mouthHint);
    if (sameExpression(this.expression, next)) return this;
    this.expression = next;
    this.applyExpression();
    return this;
  }

  /** Pushes the current expression and layout onto the parts. */
  private applyExpression(): void {
    const e = this.expression;
    if (!e) return;
    const wide = e.eyes === 'wide';
    const eyeTexture = EYE_TEXTURE[e.eyes];
    const pupilsShown = e.eyes === 'open' || wide;
    const eyeScale = wide ? ANIM.face.wideEyeScale : 1;
    const pupilScale = wide ? ANIM.face.widePupilScale : 1;

    for (const eye of [this.eyeL, this.eyeR]) eye.setTexture(eyeTexture).setScale(eyeScale);
    for (const pupil of [this.pupilL, this.pupilR]) {
      pupil.setVisible(pupilsShown).setScale(pupilScale);
    }
    for (const brow of [this.browL, this.browR]) brow.setVisible(e.brows);
    this.mouth.setTexture(MOUTH_TEXTURE[e.mouth]).setVisible(this.showRest);
    this.cheekL.setVisible(this.showRest);
    this.cheekR.setVisible(this.showRest);
    this.sweat.setVisible(e.sweat && this.showRest);
    if (!e.sweat) this.sweatMs = 0;
  }

  private placePupils(): void {
    const half = ANIM.face.eyeSpacing / 2;
    const x = this.lookX + this.driftX;
    this.pupilL.setPosition(-half + x, this.lookY);
    this.pupilR.setPosition(half + x, this.lookY);
  }

  /** The drop slides down and fades, then starts again at the top. */
  private animateSweat(dtMs: number): void {
    if (!this.sweat.visible) return;
    const { sweatY, sweatSlide, sweatPeriodMs } = ANIM.face;
    this.sweatMs = (this.sweatMs + dtMs) % sweatPeriodMs;
    const phase = this.sweatMs / sweatPeriodMs;
    this.sweat.setY(sweatY + sweatSlide * phase).setAlpha(1 - phase);
  }
}

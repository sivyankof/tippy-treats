import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import type { FaceRecipe } from '../../data/creature-looks';
import type { Expression } from './face-state';
import { browTransform, lidShape, WORRIED_BROW } from './face-recipe';
import { LICK } from '../../data/lick';
import { tongueTransform } from './lick-plan';
import { EYE_TEXTURE, FACE_TEXTURES, MOUTH_TEXTURE } from './face-textures';

/** What the parts need to know about the layer besides the expression. */
export interface PartsContext {
  recipe: FaceRecipe | null;
  /** Colour of the eyelids (the body of the creature). */
  lidColor: number;
  /** Mouth, cheeks and sweat fit on the layer. */
  showRest: boolean;
}

/**
 * One face made of pictures: eyes with pupils, lids, brows, mouth, cheeks and a sweat drop.
 * It only shows what it is told; the state and timing live in `LayerFace`.
 */
export class FaceParts extends Phaser.GameObjects.Container {
  private readonly cheekL: Phaser.GameObjects.Image;
  private readonly cheekR: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly eyeL: Phaser.GameObjects.Image;
  private readonly eyeR: Phaser.GameObjects.Image;
  private readonly pupilL: Phaser.GameObjects.Image;
  private readonly pupilR: Phaser.GameObjects.Image;
  private readonly lidL: Phaser.GameObjects.Image;
  private readonly lidR: Phaser.GameObjects.Image;
  private readonly browL: Phaser.GameObjects.Image;
  private readonly browR: Phaser.GameObjects.Image;
  private readonly sweat: Phaser.GameObjects.Image;
  private readonly tongue: Phaser.GameObjects.Image;
  private readonly tongueTip: Phaser.GameObjects.Image;
  private sweatMs = 0;
  /** Sideways pupil shift of this face (twins look at each other). */
  private gaze = 0;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const { eyeSpacing, mouthOffsetY, cheekOffsetY, cheekSpacing, browOffsetY } = ANIM.face;
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
    this.lidL = image(FACE_TEXTURES.lid, -half, 0).setOrigin(0.5, 1).setVisible(false);
    this.lidR = image(FACE_TEXTURES.lid, half, 0).setOrigin(0.5, 1).setVisible(false);
    this.browL = image(FACE_TEXTURES.brow, -half, browOffsetY);
    this.browR = image(FACE_TEXTURES.brow, half, browOffsetY);
    this.sweat = image(FACE_TEXTURES.sweat, ANIM.face.sweatX, ANIM.face.sweatY);
    this.tongue = image(FACE_TEXTURES.tongue, 0, mouthOffsetY + LICK.tongueOriginDy)
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.tongueTip = image(FACE_TEXTURES.tongueTip, 0, mouthOffsetY + LICK.tongueOriginDy)
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.setBrowPose(null, false);

    // The tongue comes out under the eyes: they cover it where it passes.
    this.add([
      this.cheekL,
      this.cheekR,
      this.mouth,
      this.tongue,
      this.tongueTip,
      this.eyeL,
      this.eyeR,
      this.pupilL,
      this.pupilR,
      this.lidL,
      this.lidR,
      this.browL,
      this.browR,
      this.sweat,
    ]);
  }

  /** Pushes an expression onto the parts. */
  apply(e: Expression, ctx: PartsContext): void {
    const { recipe, showRest } = ctx;
    const wide = e.eyes === 'wide';
    const winking = e.eyes === 'wink';
    const pupilsShown = e.eyes === 'open' || wide || winking;
    const eyeScale = wide ? ANIM.face.wideEyeScale : 1;
    const pupilScale = wide ? ANIM.face.widePupilScale : 1;

    for (const eye of [this.eyeL, this.eyeR])
      eye.setTexture(EYE_TEXTURE[e.eyes]).setScale(eyeScale);
    // A wink shuts the right eye only.
    if (winking) this.eyeR.setTexture(EYE_TEXTURE.closed);
    this.pupilL.setVisible(pupilsShown).setScale(pupilScale);
    this.pupilR.setVisible(pupilsShown && !winking).setScale(pupilScale);
    this.applyLids(e.lids ? recipe : null, ctx.lidColor);
    for (const brow of [this.browL, this.browR]) brow.setVisible(e.brows);
    this.setBrowPose(recipe, e.ownBrows);
    this.mouth.setTexture(MOUTH_TEXTURE[e.mouth]).setVisible(showRest);
    this.applyCheeks(recipe, showRest, e.puffed === true);
    this.sweat.setVisible(e.sweat && showRest);
    const tongueOut = e.tongue === true && showRest;
    this.tongue.setVisible(tongueOut);
    this.tongueTip.setVisible(tongueOut);
    if (!e.sweat) this.sweatMs = 0;
  }

  /** Sideways pupil shift of this face for good. */
  setGaze(gaze: number): void {
    this.gaze = gaze;
  }

  /** Pupil position: `x`, `y` is the glide towards the look target plus the sway drift. */
  placePupils(x: number, y: number): void {
    const half = ANIM.face.eyeSpacing / 2;
    this.pupilL.setPosition(-half + x + this.gaze, y);
    this.pupilR.setPosition(half + x + this.gaze, y);
  }

  /**
   * Points the tongue from the mouth at (`dx`, `dy`) in face pixels, `reach` (0..1) of the way
   * out, swung by `swingDeg`. Whether it shows is decided by the expression.
   */
  placeTongue(dx: number, dy: number, reach: number, swingDeg: number): void {
    const t = tongueTransform(dx, dy - (ANIM.face.mouthOffsetY + LICK.tongueOriginDy), reach);
    const angle = t.angleDeg + swingDeg;
    this.tongue.setAngle(angle).setScale(1, t.scaleY);
    // The tip rides at the end of the stem, turned the same way (clockwise from straight down).
    const turn = (angle * Math.PI) / 180;
    const originY = ANIM.face.mouthOffsetY + LICK.tongueOriginDy;
    this.tongueTip
      .setAngle(angle)
      .setPosition(-Math.sin(turn) * t.tipDistance, originY + Math.cos(turn) * t.tipDistance);
  }

  /** The drop slides down and fades, then starts again at the top. */
  animateSweat(dtMs: number): void {
    if (!this.sweat.visible) return;
    const { sweatY, sweatSlide, sweatPeriodMs } = ANIM.face;
    this.sweatMs = (this.sweatMs + dtMs) % sweatPeriodMs;
    const phase = this.sweatMs / sweatPeriodMs;
    this.sweat.setY(sweatY + sweatSlide * phase).setAlpha(1 - phase);
  }

  /** Calm face with a fresh sweat drop. */
  resetSweat(): void {
    this.sweatMs = 0;
    this.sweat.setPosition(ANIM.face.sweatX, ANIM.face.sweatY).setAlpha(1);
  }

  private applyLids(recipe: FaceRecipe | null, color: number): void {
    const covers: ReadonlyArray<readonly [Phaser.GameObjects.Image, number]> = [
      [this.lidL, recipe?.lidLeft ?? 0],
      [this.lidR, recipe?.lidRight ?? 0],
    ];
    for (const [lid, cover] of covers) {
      lid.setVisible(cover > 0);
      if (cover <= 0) continue;
      const shape = lidShape(cover);
      lid.setTint(color).setY(shape.y).setScale(shape.scaleX, shape.scaleY);
    }
  }

  /** Brow pictures take the creature's pose, or the worried pair for the "ouch" and "horror" faces. */
  private setBrowPose(recipe: FaceRecipe | null, own: boolean): void {
    const textureKey = recipe?.lightBrows && own ? FACE_TEXTURES.browLight : FACE_TEXTURES.brow;
    const sides = [
      [this.browL, 'left', recipe?.browLeft],
      [this.browR, 'right', recipe?.browRight],
    ] as const;
    for (const [brow, side, pose] of sides) {
      const t = browTransform(own && pose ? pose : WORRIED_BROW, side);
      brow.setTexture(textureKey).setAngle(t.angle).setY(t.y).setScale(t.scaleX, t.scaleY);
    }
  }

  private applyCheeks(recipe: FaceRecipe | null, showRest: boolean, puffed: boolean): void {
    const scale = (recipe?.cheekScale ?? 1) * (puffed ? ANIM.face.puffCheekScale : 1);
    const spread = recipe?.cheekSpread ?? 1;
    const half = (ANIM.face.cheekSpacing / 2) * spread;
    this.cheekL
      .setVisible(showRest && scale > 0)
      .setScale(scale)
      .setX(-half);
    this.cheekR
      .setVisible(showRest && scale > 0)
      .setScale(scale)
      .setX(half);
  }
}

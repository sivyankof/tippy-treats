import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import type { FaceRecipe } from '../../data/creature-looks';
import type { Expression } from './face-state';
import { browTransform, lidShape, WORRIED_BROW } from './face-recipe';
import { LICK } from '../../data/lick';
import type { EyeLook, LickFace, LipsTongue } from './lick-plan';
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
    this.tongue = image(FACE_TEXTURES.tongue, 0, 0).setOrigin(0.5, 1).setVisible(false);
    this.tongueTip = image(FACE_TEXTURES.tongueTip, 0, 0).setOrigin(0.5, 1).setVisible(false);
    this.setBrowPose(null, false);

    // The short tongue that licks the lips lies over the mouth, under the eyes.
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
    this.mouth.setOrigin(0.5).setPosition(0, ANIM.face.mouthOffsetY).setScale(1);
    this.applyCheeks(recipe, showRest, e.puffed === true);
    this.sweat.setVisible(e.sweat && showRest);
    this.tongue.setVisible(false);
    this.tongueTip.setVisible(false);
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
   * The face of a lick over the current expression: raised brows, the mouth from a small "oh"
   * through pursed lips to gaping open (it opens down from the upper lip), the eyes open, squinted
   * or blissfully shut, warmer or puffed cheeks. Call `apply` again to go back to the expression.
   */
  poseLick(face: Readonly<LickFace>): void {
    const f = LICK.face;
    if (face.brow > 0) {
      const pose = {
        angleDeg: f.brows.angleDeg,
        offsetY: f.brows.liftPx * face.brow,
        scaleX: 1,
        scaleY: 1,
      };
      for (const [brow, side, sign] of [
        [this.browL, 'left', -1],
        [this.browR, 'right', 1],
      ] as const) {
        const shown = face.browSide === 0 || face.browSide === sign;
        brow.setVisible(shown);
        if (!shown) continue;
        const t = browTransform(pose, side);
        FaceParts.show(brow, FACE_TEXTURES.brow).setAngle(t.angle).setY(t.y).setScale(1);
      }
    }
    this.poseMouth(face);
    this.poseEye(this.eyeL, this.pupilL, face.eyeL);
    this.poseEye(this.eyeR, this.pupilR, face.eyeR);
    const swell = face.blush > 0 ? 1 + (LICK.happy.blushScale - 1) * face.blush : 1;
    const puff = 1 + (f.puff.scale - 1) * face.puff;
    if (face.blush > 0 || face.puff > 0) {
      for (const cheek of [this.cheekL, this.cheekR]) {
        if (face.blush > 0) FaceParts.show(cheek, FACE_TEXTURES.cheekHot);
        cheek.setScale(swell * puff);
      }
    }
  }

  /** Sets a texture only when it changes (a pose is laid every frame). */
  private static show(image: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
    return image.texture.key === key ? image : image.setTexture(key);
  }

  private poseMouth(face: Readonly<LickFace>): void {
    const { mouthOffsetY } = ANIM.face;
    const f = LICK.face;
    switch (face.mouth) {
      case 'oh':
      case 'purse':
        FaceParts.show(this.mouth, FACE_TEXTURES.mouthO)
          .setOrigin(0.5)
          .setPosition(0, mouthOffsetY)
          .setScale(Math.max(0, (face.mouth === 'oh' ? f.ohScale : 1) * face.open));
        return;
      case 'gape':
        FaceParts.show(this.mouth, FACE_TEXTURES.mouthGape)
          .setOrigin(0.5, 0)
          .setPosition(0, f.gapeLipY)
          .setScale(Math.max(0.3, Math.min(1.15, 0.6 + 0.4 * face.open)), Math.max(0, face.open));
        return;
      case 'wide':
        FaceParts.show(this.mouth, FACE_TEXTURES.mouthOpen)
          .setOrigin(0.5, 0)
          .setPosition(0, f.gapeLipY)
          .setScale(1, Math.max(0, face.open));
        return;
      default:
        return;
    }
  }

  private poseEye(
    eye: Phaser.GameObjects.Image,
    pupil: Phaser.GameObjects.Image,
    look: EyeLook,
  ): void {
    if (look === 'expr') return;
    const texture =
      look === 'bliss'
        ? FACE_TEXTURES.eyeHappy
        : look === 'shut'
          ? FACE_TEXTURES.eyeClosed
          : FACE_TEXTURES.eyeOpen;
    FaceParts.show(eye, texture).setScale(1);
    pupil.setVisible(look === 'open').setScale(1);
  }

  /** The short tongue licking the lips (`null`: none). */
  placeLipsTongue(pose: Readonly<LipsTongue> | null): void {
    if (!pose || !pose.shown || pose.length <= 0) {
      this.tongue.setVisible(false);
      this.tongueTip.setVisible(false);
      return;
    }
    const { tipPx: tipHeight, stemTexturePx: stemTexture } = LICK.lips;
    const w = pose.widthScale;
    const tip = tipHeight * w;
    const stem = Math.max(0, pose.length - tip);
    const turn = (pose.angleDeg * Math.PI) / 180;
    this.tongue
      .setVisible(stem > 0)
      .setPosition(pose.x, pose.y)
      .setAngle(pose.angleDeg)
      .setScale(w, stem / stemTexture);
    // The tip rides at the end of the stem, turned the same way; a shorter tongue is the tip alone, smaller.
    const tipScale = w * Math.min(1, pose.length / tip);
    this.tongueTip
      .setVisible(true)
      .setAngle(pose.angleDeg)
      .setScale(tipScale)
      .setPosition(pose.x + Math.sin(turn) * stem, pose.y - Math.cos(turn) * stem);
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
      .setTexture(FACE_TEXTURES.cheek)
      .setVisible(showRest && scale > 0)
      .setScale(scale)
      .setX(-half);
    this.cheekR
      .setTexture(FACE_TEXTURES.cheek)
      .setVisible(showRest && scale > 0)
      .setScale(scale)
      .setX(half);
  }
}

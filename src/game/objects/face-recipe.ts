import { ANIM } from '../../data/anim';
import type { BrowPose, FaceRecipe, PairLayout } from '../../data/creature-looks';

/** Where and how big a half-closed eyelid is, relative to the centre of its eye. */
export interface LidShape {
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * The lid is a half-disc whose flat edge is the lid line. Its flat edge sits `cover` (0..1) of the
 * eye height below the top of the eye, and the disc is as wide as the eye is at that line.
 */
export function lidShape(cover: number): LidShape {
  const { eyeRadius, lidWidth, lidHeight, lidBleed } = ANIM.face;
  const share = Math.min(1, Math.max(0, cover));
  const y = -eyeRadius + share * eyeRadius * 2;
  const chordHalf = Math.sqrt(Math.max(0, eyeRadius * eyeRadius - y * y));
  return {
    y,
    scaleX: Math.max(0.1, ((chordHalf * 2) / lidWidth) * lidBleed),
    scaleY: ((share * eyeRadius * 2) / lidHeight) * lidBleed,
  };
}

/** What a brow image is set to: rotation (degrees, Phaser sign), height and scale. */
export interface BrowTransform {
  angle: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** The worried "домиком" brows of the "ouch" and "horror" reactions and of a scared face. */
export const WORRIED_BROW: BrowPose = {
  angleDeg: ANIM.face.browRaiseDeg,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
};

/**
 * Brow image values for a pose. The inner ends turn up for a positive angle: the left brow
 * turns counter-clockwise, the right one clockwise.
 */
export function browTransform(pose: BrowPose, side: 'left' | 'right'): BrowTransform {
  return {
    angle: side === 'left' ? -pose.angleDeg : pose.angleDeg,
    y: ANIM.face.browOffsetY + pose.offsetY,
    scaleX: pose.scaleX,
    scaleY: pose.scaleY,
  };
}

/** Layout of the face group for a layer width. */
export interface FaceLayout {
  /** Scale of the whole face group. */
  scale: number;
  /** Mouth, cheeks and sweat show; below this only eyes and brows stay. */
  showRest: boolean;
}

/** Scale of the face and whether it is wide enough for more than eyes; twins use their own widths. */
export function faceLayout(width: number, recipe: FaceRecipe | null): FaceLayout {
  const pair: PairLayout | null = recipe?.pair ?? null;
  const fullWidth = pair?.fullWidth ?? ANIM.face.fullWidth;
  const eyesOnly = pair?.eyesOnlyWidth ?? ANIM.face.eyesOnlyWidth;
  return { scale: Math.min(1, width / fullWidth), showRest: width >= eyesOnly };
}

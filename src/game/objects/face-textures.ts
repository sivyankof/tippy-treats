import type { EyeKind, MouthKind } from './face-state';

/** Texture keys of the face parts. Each key is the name of an SVG file in assets/svg. */
export const FACE_TEXTURES = {
  eyeOpen: 'face_eye_open',
  eyeClosed: 'face_eye_closed',
  eyeHappy: 'face_eye_happy',
  pupil: 'face_pupil',
  brow: 'face_brow',
  browLight: 'face_brow_light',
  lid: 'face_lid',
  mouthSmile: 'face_mouth_smile',
  mouthOpen: 'face_mouth_open',
  mouthO: 'face_mouth_o',
  mouthFlat: 'face_mouth_flat',
  mouthScared: 'face_mouth_scared',
  mouthYum: 'face_mouth_yum',
  /** The mouth gaping to half the face, teeth and the dark depth showing (the big lick). */
  mouthGape: 'face_mouth_gape',
  cheek: 'face_cheek',
  /** The warmer blush of a happy lick. */
  cheekHot: 'face_cheek_hot',
  sweat: 'face_sweat',
  tongue: 'face_tongue',
  tongueTip: 'face_tongue_tip',
} as const;

/** Eye picture per eye kind; wide eyes are the open eye drawn larger. */
export const EYE_TEXTURE: Readonly<Record<EyeKind, string>> = {
  open: FACE_TEXTURES.eyeOpen,
  closed: FACE_TEXTURES.eyeClosed,
  happy: FACE_TEXTURES.eyeHappy,
  wide: FACE_TEXTURES.eyeOpen,
  wink: FACE_TEXTURES.eyeOpen,
};

export const MOUTH_TEXTURE: Readonly<Record<MouthKind, string>> = {
  smile: FACE_TEXTURES.mouthSmile,
  open: FACE_TEXTURES.mouthOpen,
  o: FACE_TEXTURES.mouthO,
  flat: FACE_TEXTURES.mouthFlat,
  scared: FACE_TEXTURES.mouthScared,
  yum: FACE_TEXTURES.mouthYum,
};

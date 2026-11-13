import type * as Phaser from 'phaser';
import type { EyeKind, MouthKind } from './face-state';

/** Texture keys of the face parts. Each key is the name of an SVG file in assets/svg. */
export const FACE_TEXTURES = {
  eyeOpen: 'face_eye_open',
  eyeClosed: 'face_eye_closed',
  eyeHappy: 'face_eye_happy',
  pupil: 'face_pupil',
  brow: 'face_brow',
  mouthSmile: 'face_mouth_smile',
  mouthOpen: 'face_mouth_open',
  mouthO: 'face_mouth_o',
  mouthFlat: 'face_mouth_flat',
  mouthScared: 'face_mouth_scared',
  mouthYum: 'face_mouth_yum',
  cheek: 'face_cheek',
  sweat: 'face_sweat',
} as const;

/** Eye picture per eye kind; wide eyes are the open eye drawn larger. */
export const EYE_TEXTURE: Readonly<Record<EyeKind, string>> = {
  open: FACE_TEXTURES.eyeOpen,
  closed: FACE_TEXTURES.eyeClosed,
  happy: FACE_TEXTURES.eyeHappy,
  wide: FACE_TEXTURES.eyeOpen,
};

export const MOUTH_TEXTURE: Readonly<Record<MouthKind, string>> = {
  smile: FACE_TEXTURES.mouthSmile,
  open: FACE_TEXTURES.mouthOpen,
  o: FACE_TEXTURES.mouthO,
  flat: FACE_TEXTURES.mouthFlat,
  scared: FACE_TEXTURES.mouthScared,
  yum: FACE_TEXTURES.mouthYum,
};

// The SVG sources are bundled as text. The Phaser loader fetches files by URL, and small files
// would otherwise be inlined by Vite as data URIs, which its loader cannot read, so each
// source is handed over as a short-lived blob URL. Pictures are drawn at the size written
// in the file, in logical pixels.
const FACE_SOURCES = import.meta.glob<string>('../../../assets/svg/face_*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function faceSource(key: string): string {
  const source = FACE_SOURCES[`../../../assets/svg/${key}.svg`];
  if (!source) throw new Error(`Missing face picture assets/svg/${key}.svg`);
  return source;
}

/** Queues every face picture in the scene loader; call it from `preload`. */
export function loadFaceTextures(scene: Phaser.Scene): void {
  const urls: string[] = [];
  for (const key of Object.values(FACE_TEXTURES)) {
    const blob = new Blob([faceSource(key)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    urls.push(url);
    scene.load.svg(key, url);
  }
  scene.load.once('complete', () => {
    for (const url of urls) URL.revokeObjectURL(url);
  });
}

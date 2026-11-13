import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';

export const FACE_TEXTURES = {
  eye: 'face_eye',
  pupil: 'face_pupil',
  mouthSmile: 'face_mouth_smile',
  mouthO: 'face_mouth_o',
  cheek: 'face_cheek',
} as const;

const EYE_OUTLINE = 3;
const MOUTH_LINE = 5;
const CHEEK_COLOR = 0xff8fa8;
const CHEEK_ALPHA = 0.55;
const CHEEK_WIDTH_RATIO = 1.6;
const CHEEK_HEIGHT_RATIO = 1;
const SMILE_WIDTH_RATIO = 1.5;
const SMILE_HALF_ANGLE = 0.38 * Math.PI;
const O_RADIUS_RATIO = 0.6;

/** Draws the small shared face parts once; every layer view reuses them. */
export function createFaceTextures(scene: Phaser.Scene): void {
  const { eyeRadius, pupilRadius } = ANIM.face;

  const eyeSize = (eyeRadius + EYE_OUTLINE) * 2;
  bakeTexture(scene, FACE_TEXTURES.eye, eyeSize, eyeSize, (g) => {
    const c = eyeSize / 2;
    g.fillStyle(PALETTE.textDark, 1).fillCircle(c, c, eyeRadius + EYE_OUTLINE);
    g.fillStyle(PALETTE.textLight, 1).fillCircle(c, c, eyeRadius);
  });

  const pupilSize = pupilRadius * 2 + 2;
  bakeTexture(scene, FACE_TEXTURES.pupil, pupilSize, pupilSize, (g) => {
    const c = pupilSize / 2;
    g.fillStyle(PALETTE.textDark, 1).fillCircle(c, c, pupilRadius);
    g.fillStyle(PALETTE.textLight, 1).fillCircle(c - pupilRadius * 0.3, c - pupilRadius * 0.3, 3);
  });

  const smileInner = pupilRadius * 2 * SMILE_WIDTH_RATIO;
  const smileR = smileInner / 2 / Math.sin(SMILE_HALF_ANGLE);
  const smileDepth = smileR * (1 - Math.cos(SMILE_HALF_ANGLE));
  const smileW = smileInner + MOUTH_LINE * 2;
  const smileH = smileDepth + MOUTH_LINE * 2;
  bakeTexture(scene, FACE_TEXTURES.mouthSmile, smileW, smileH, (g) => {
    g.lineStyle(MOUTH_LINE, PALETTE.textDark, 1);
    g.beginPath();
    g.arc(
      smileW / 2,
      MOUTH_LINE - smileR * Math.cos(SMILE_HALF_ANGLE),
      smileR,
      Math.PI / 2 - SMILE_HALF_ANGLE,
      Math.PI / 2 + SMILE_HALF_ANGLE,
    );
    g.strokePath();
  });

  const oSize = pupilRadius * O_RADIUS_RATIO * 2 + 8;
  bakeTexture(scene, FACE_TEXTURES.mouthO, oSize, oSize, (g) => {
    g.fillStyle(PALETTE.textDark, 1).fillCircle(oSize / 2, oSize / 2, oSize / 2 - 2);
    g.fillStyle(PALETTE.berry, 1).fillCircle(oSize / 2, oSize / 2 + 2, oSize / 2 - 6);
  });

  const cheekW = pupilRadius * CHEEK_WIDTH_RATIO * 2;
  const cheekH = pupilRadius * CHEEK_HEIGHT_RATIO * 2;
  bakeTexture(scene, FACE_TEXTURES.cheek, cheekW, cheekH, (g) => {
    g.fillStyle(CHEEK_COLOR, CHEEK_ALPHA).fillEllipse(cheekW / 2, cheekH / 2, cheekW, cheekH);
  });
}

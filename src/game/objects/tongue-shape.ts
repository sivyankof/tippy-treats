import { ANIM } from '../../data/anim';
import { LICK } from '../../data/lick';
import { clamp01, smoothstep } from '../../util/math';
import { pieceDistance, type LickScene } from './lick-plan';

/**
 * Width of the long tongue (without its outline) `t` of the way from the root (0) to the tip (1):
 * narrow where it leaves the mouth, widening smoothly to its full width at `LICK.tongue.fullAt`
 * and keeping it to the wide round tip.
 */
export function tongueWidthAt(scene: LickScene, t: number): number {
  const { root, full } = LICK.tongue.width[scene];
  return root + (full - root) * smoothstep(clamp01(t / LICK.tongue.fullAt));
}

/** The widest the tongue of a scene gets, with its outline. */
export function tongueOuterWidth(scene: LickScene): number {
  return LICK.tongue.width[scene].full + LICK.tongue.outline * 2;
}

/**
 * How near the edge of the ribbon (with its outline) comes to (x, y): negative inside it. The
 * tongue is `count` points (flat `[x0, y0, ...]`) from the root to the tip, `widthMul` of its
 * width; the width at a point is taken where along the chain it is nearest.
 */
export function ribbonGap(
  scene: LickScene,
  points: readonly number[],
  count: number,
  x: number,
  y: number,
  widthMul = 1,
): number {
  let best = Infinity;
  for (let i = 1; i < count; i++) {
    const d = pieceDistance(points, i, x, y);
    const width = tongueWidthAt(scene, (i - 0.5) / (count - 1)) * widthMul;
    const half = width / 2 + LICK.tongue.outline;
    best = Math.min(best, d - half);
  }
  return best;
}

/** Which eyes the ribbon of the big scene lies over now. */
export interface EyesCovered {
  left: boolean;
  right: boolean;
}

/**
 * The eyes the tongue covers: an eye at (±half the eye spacing scaled by `scaleX`, `eyeY`)
 * around (`ox`, `oy`) is under the tongue when the ribbon comes nearer to its centre than
 * `LICK.face.eyeCover.coverShare` of its radius. Fills `out`.
 */
export function eyesUnderTongue(
  points: readonly number[],
  count: number,
  ox: number,
  oy: number,
  scaleX: number,
  eyeY: number,
  out: EyesCovered,
): EyesCovered {
  const half = (ANIM.face.eyeSpacing / 2) * scaleX;
  const limit = ANIM.face.eyeRadius * LICK.face.eyeCover.coverShare;
  out.left = ribbonGap('big', points, count, ox - half, oy + eyeY) < limit;
  out.right = ribbonGap('big', points, count, ox + half, oy + eyeY) < limit;
  return out;
}

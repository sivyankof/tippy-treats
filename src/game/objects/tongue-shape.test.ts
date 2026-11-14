import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { LICK } from '../../data/lick';
import { lickDurationMs, lickFrame, loopShape, tongueBody, type LickScene } from './lick-plan';
import { eyesUnderTongue, ribbonGap, tongueOuterWidth, tongueWidthAt } from './tongue-shape';

const PLAIN = LICK.styles.plain;
const POINTS = LICK.tongue.segments + 1;
const EYE_X = ANIM.face.eyeSpacing / 2;
/** The width of the tongue before it was made wider. */
const OLD_WIDTH = 40;

/** Runs a scene every few milliseconds with the tongue out. */
function eachTongue(
  scene: LickScene,
  dir: 1 | -1,
  visit: (points: number[], widthMul: number) => void,
): void {
  const shape = loopShape(720, 1, dir);
  const points: number[] = [];
  for (let t = 0; t <= lickDurationMs(scene); t += 5) {
    const widthMul = tongueBody(scene, lickFrame(scene, t), PLAIN, shape, points);
    if (widthMul > 0) visit(points, widthMul);
  }
}

describe('tongueWidthAt', () => {
  it('is a wide ribbon: 1.6 to 1.8 times the old width in the middle and at the tip of the big scene', () => {
    for (const t of [0.5, 1]) {
      expect(tongueWidthAt('big', t)).toBeGreaterThanOrEqual(OLD_WIDTH * 1.6);
      expect(tongueWidthAt('big', t)).toBeLessThanOrEqual(OLD_WIDTH * 1.8);
    }
  });

  it('narrows smoothly to the root, where it fits in the open mouth', () => {
    for (const scene of ['big', 'short'] as const) {
      expect(tongueWidthAt(scene, 0)).toBe(LICK.tongue.width[scene].root);
      expect(tongueWidthAt(scene, 0)).toBeLessThan(tongueWidthAt(scene, 1) * 0.6);
      let last = 0;
      for (let t = 0; t <= 1; t += 0.05) {
        expect(tongueWidthAt(scene, t)).toBeGreaterThanOrEqual(last);
        last = tongueWidthAt(scene, t);
      }
    }
  });

  it('is much wider in the big scene than in the short one', () => {
    expect(tongueOuterWidth('big')).toBeGreaterThan(tongueOuterWidth('short') * 1.6);
    expect(tongueWidthAt('big', 0.5)).toBeGreaterThan(tongueWidthAt('short', 0.5) * 1.6);
  });
});

describe('the tongue and the eyes', () => {
  it('passes over each eye in the big scene, and leaves it again', () => {
    const eyeY = -LICK.face.gape.eyesUpPx;
    for (const dir of [1, -1] as const) {
      const seen = { left: false, right: false, free: false };
      const covered = { left: false, right: false };
      eachTongue('big', dir, (points) => {
        eyesUnderTongue(points, POINTS, 0, 0, 1, eyeY, covered);
        seen.left ||= covered.left;
        seen.right ||= covered.right;
        seen.free ||= !covered.left && !covered.right;
      });
      expect(seen).toEqual({ left: true, right: true, free: true });
    }
  });

  it('keeps off the eyes in the short scene', () => {
    const allowed = ANIM.face.eyeRadius - LICK.shortPath.eyeClearPx;
    for (const dir of [1, -1] as const) {
      eachTongue('short', dir, (points, widthMul) => {
        for (const x of [-EYE_X, EYE_X]) {
          const gap = ribbonGap('short', points, POINTS, x, 0, widthMul);
          expect(gap).toBeGreaterThanOrEqual(allowed);
        }
      });
    }
  });
});

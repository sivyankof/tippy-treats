import { describe, expect, it } from 'vitest';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { pressAgeMs, rayAngles, rayPose } from './tap-rays';

const spec = TUTORIAL_ANIM.rays;

describe('rayAngles', () => {
  it('spreads the rays evenly and symmetrically around straight up', () => {
    const angles = rayAngles(5, 120);
    expect(angles).toHaveLength(5);
    expect(angles[2]).toBeCloseTo(-Math.PI / 2);
    expect(angles[0]! + angles[4]!).toBeCloseTo(-Math.PI);
    expect(angles[4]! - angles[0]!).toBeCloseTo((120 * Math.PI) / 180);
  });

  it('puts a single ray straight up', () => {
    expect(rayAngles(1, 90)).toEqual([-Math.PI / 2]);
  });
});

describe('pressAgeMs', () => {
  it('is zero at the top of the press and counts up to the period', () => {
    expect(pressAgeMs(200, 800)).toBe(0);
    expect(pressAgeMs(300, 800)).toBe(100);
    expect(pressAgeMs(100, 800)).toBe(700);
    expect(pressAgeMs(1000, 800)).toBe(0);
  });
});

describe('rayPose', () => {
  it('starts at the start radius, fully opaque', () => {
    expect(rayPose(0, spec)).toEqual({ radius: spec.startRadius, alpha: 1, scale: 1 });
  });

  it('flies outwards, fades after fadeFrom and is gone at the end of its life', () => {
    const mid = rayPose(spec.lifeMs * spec.fadeFrom, spec);
    expect(mid?.alpha).toBe(1);
    expect(mid?.radius).toBeGreaterThan(spec.startRadius);
    const late = rayPose(spec.lifeMs * 0.9, spec);
    expect(late?.alpha).toBeLessThan(0.3);
    expect(late?.radius).toBeLessThanOrEqual(spec.startRadius + spec.travel);
    expect(rayPose(spec.lifeMs, spec)).toBeNull();
    expect(rayPose(-1, spec)).toBeNull();
  });
});

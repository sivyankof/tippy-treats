import { describe, expect, it } from 'vitest';
import { LAP_EDGE } from '../../../data/zones/lap-edge';
import { EdgeTween, edgeAlpha, edgeX, fadeIn } from './lap-edge-math';

describe('lap edge maths', () => {
  it('puts the edges half the cap either side of the top layer', () => {
    expect(edgeX(300, 90, -1)).toBe(210);
    expect(edgeX(300, 90, 1)).toBe(390);
  });

  it('fades in over the set time', () => {
    expect(fadeIn(0)).toBe(0);
    expect(fadeIn(LAP_EDGE.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(fadeIn(LAP_EDGE.fadeInMs * 3)).toBe(1);
  });

  it('twinkles inside its band on full and holds still on minimal', () => {
    const [lo, hi] = LAP_EDGE.twinkleAlpha;
    for (let t = 0; t < 3200; t += 100) {
      const a = edgeAlpha(t, false);
      expect(a).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(a).toBeLessThanOrEqual(hi + 1e-9);
      expect(edgeAlpha(t, true)).toBe(LAP_EDGE.minimalAlpha);
    }
    expect(edgeAlpha(0, false)).not.toBe(edgeAlpha(LAP_EDGE.twinklePeriodMs / 2, false));
  });

  it('stays hidden before lap 2 and fades in at its first layer without sliding', () => {
    const tween = new EdgeTween();
    tween.setTarget(1, 360);
    tween.step(100);
    expect(tween.shown).toBe(false);
    tween.setTarget(2, 324);
    expect(tween.shown).toBe(true);
    expect(tween.half).toBe(162);
    tween.step(LAP_EDGE.fadeInMs / 2);
    expect(tween.fade).toBeCloseTo(0.5);
    tween.step(LAP_EDGE.fadeInMs);
    expect(tween.fade).toBe(1);
    expect(tween.half).toBe(162);
  });

  it('slides to the new cap over the slide time and ignores a repeated cap', () => {
    const tween = new EdgeTween();
    tween.setTarget(2, 324);
    tween.step(1000);
    tween.setTarget(2, 324);
    tween.step(50);
    expect(tween.half).toBe(162);
    tween.setTarget(3, 288);
    tween.step(LAP_EDGE.slideMs / 2);
    expect(tween.half).toBeCloseTo(153);
    tween.step(LAP_EDGE.slideMs);
    expect(tween.half).toBe(144);
  });

  it('hides again and restarts the fade when shown anew', () => {
    const tween = new EdgeTween();
    tween.setTarget(2, 324);
    tween.step(1000);
    tween.hide();
    expect(tween.shown).toBe(false);
    tween.setTarget(2, 324);
    expect(tween.fade).toBe(0);
  });
});

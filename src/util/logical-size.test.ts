import { describe, expect, it } from 'vitest';
import { computeLogicalSize } from './logical-size';

const limits = { width: 1080, minHeight: 1920, maxHeight: 2520 };

describe('computeLogicalSize', () => {
  it.each([
    [390, 844, 2337],
    [430, 932, 2341],
    [360, 640, 1920],
  ])('fits a %i×%i phone viewport', (w, h, expected) => {
    expect(computeLogicalSize(w, h, limits)).toEqual({
      width: 1080,
      height: expected,
      safeTop: 0,
      safeBottom: 0,
    });
  });

  it('clamps wide viewports to the minimum height', () => {
    expect(computeLogicalSize(1920, 1080, limits).height).toBe(1920);
  });

  it('clamps very tall viewports to the maximum height', () => {
    expect(computeLogicalSize(300, 900, limits).height).toBe(2520);
  });

  it('falls back to the minimum height for an empty viewport', () => {
    expect(computeLogicalSize(0, 0, limits).height).toBe(1920);
    expect(computeLogicalSize(Number.NaN, 500, limits).height).toBe(1920);
  });

  it('keeps the canvas full screen and puts the insets around the safe band', () => {
    // iPhone 14 Pro Max: island 59 pt, gesture bar 34 pt.
    const size = computeLogicalSize(430, 932, limits, { top: 59, bottom: 34 });
    expect(size.safeTop).toBe(148);
    expect(size.safeBottom).toBe(85);
    // Same proportions as the viewport: no margins.
    expect(size.height).toBe(2341);
    expect(size.height - size.safeTop - size.safeBottom).toBe(2108);
  });

  it('makes a short safe band the minimum height, with side margins', () => {
    // An iPhone SE: 375×667 with a 20 pt status bar.
    const size = computeLogicalSize(375, 667, limits, { top: 20, bottom: 0 });
    expect(size.height - size.safeTop - size.safeBottom).toBe(1920);
    expect(size.safeTop).toBe(Math.round((20 * 1920) / 647));
    // The logical proportions match the viewport height: the canvas fills it, narrower than the width.
    expect(size.height / 1080).toBeGreaterThan(667 / 375);
  });

  it('caps a tall safe band at the maximum height and keeps the insets in full', () => {
    const size = computeLogicalSize(300, 900, limits, { top: 40, bottom: 20 });
    expect(size.height - size.safeTop - size.safeBottom).toBe(2520);
    expect(size.safeTop).toBe(144);
    expect(size.safeBottom).toBe(72);
  });

  it('ignores insets that leave no band', () => {
    expect(computeLogicalSize(390, 844, limits, { top: 500, bottom: 400 })).toEqual({
      width: 1080,
      height: 2337,
      safeTop: 0,
      safeBottom: 0,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { computeLogicalSize } from './logical-size';

const limits = { width: 1080, minHeight: 1920, maxHeight: 2520 };

describe('computeLogicalSize', () => {
  it.each([
    [390, 844, 2337],
    [430, 932, 2341],
    [360, 640, 1920],
  ])('fits a %i×%i phone viewport', (w, h, expected) => {
    expect(computeLogicalSize(w, h, limits)).toEqual({ width: 1080, height: expected });
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
});

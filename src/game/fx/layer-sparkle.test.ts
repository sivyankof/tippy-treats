import { describe, expect, it } from 'vitest';
import { ringPoint, sparkleDelay } from './layer-sparkle';

describe('ringPoint', () => {
  it('starts at the top left corner of the ring and walks clockwise', () => {
    expect(ringPoint(0, 100, 40, 10)).toEqual({ x: -60, y: -30 });
    expect(ringPoint(0.25, 100, 40, 10).y).toBe(-30);
    expect(ringPoint(0.5, 100, 40, 10).x).toBeCloseTo(60);
  });
  it('always lies on the rectangle around the layer, outside it', () => {
    for (let u = 0; u < 1; u += 0.037) {
      const p = ringPoint(u, 100, 40, 10);
      const onSide = Math.abs(Math.abs(p.x) - 60) < 1e-9 || Math.abs(Math.abs(p.y) - 30) < 1e-9;
      expect(onSide).toBe(true);
    }
  });
  it('wraps around', () => {
    expect(ringPoint(1.25, 100, 40, 10)).toEqual(ringPoint(0.25, 100, 40, 10));
  });
});

describe('sparkleDelay', () => {
  it('stays inside the range', () => {
    expect(sparkleDelay([1500, 3000], () => 0)).toBe(1500);
    expect(sparkleDelay([1500, 3000], () => 1)).toBe(3000);
  });
});

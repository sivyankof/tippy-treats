import { describe, expect, it } from 'vitest';
import { arcCurve, arcSide, bandAt, rimPolyline, swell } from './rainbow-arc-geometry';

describe('arcCurve', () => {
  it('arches above both ends to the signed side and comes down onto the end', () => {
    const from = { x: 100, y: 300 };
    const to = { x: 100, y: 100 };
    const right = arcCurve(from, to, 200, 120, 1, 20);
    expect(right[0]).toMatchObject(from);
    expect(right[right.length - 1]!.x).toBeCloseTo(100);
    expect(Math.max(...right.map((p) => p.x))).toBeGreaterThan(200);
    expect(Math.min(...right.map((p) => p.x))).toBeGreaterThanOrEqual(99);
    expect(Math.min(...right.map((p) => p.y))).toBeLessThan(to.y - 30);
    const last = right[right.length - 1]!;
    const before = right[right.length - 2]!;
    expect(last.y).toBeGreaterThan(before.y);
    const left = arcCurve(from, to, -200, 120, 1, 20);
    expect(Math.min(...left.map((p) => p.x))).toBeLessThan(0);
  });
  it('keeps the normal on the outer edge of the arch', () => {
    for (const side of [200, -200]) {
      const pts = arcCurve({ x: 100, y: 300 }, { x: 100, y: 100 }, side, 120, 1, 20);
      const apex = pts.reduce((m, p) => (p.y < m.y ? p : m));
      expect(apex.ny).toBeLessThan(-0.9);
    }
  });
  it('stops part way while it grows', () => {
    const pts = arcCurve({ x: 0, y: 0 }, { x: 200, y: 0 }, 50, 100, 0.5, 10);
    expect(pts[pts.length - 1]!.x).toBeLessThan(160);
  });
});

describe('arcSide', () => {
  it('follows the end once it is clear of the start and keeps the side near it', () => {
    expect(arcSide(1, -80, 40)).toBe(-1);
    expect(arcSide(1, 80, 40)).toBe(1);
    expect(arcSide(-1, 10, 40)).toBe(-1);
    expect(arcSide(1, -10, 40)).toBe(1);
  });
});

describe('rimPolyline', () => {
  it('is closed and its position runs from 0 to 1', () => {
    const pts = rimPolyline(0, 0, 100, 40, 10, 10);
    expect(pts[0]!.u).toBe(0);
    expect(pts[pts.length - 1]!.u).toBeCloseTo(1);
    expect(pts[pts.length - 1]!.x).toBeCloseTo(pts[0]!.x);
  });
});

describe('bandAt', () => {
  it('wraps around the bands and slides with the phase', () => {
    expect(bandAt(0, 0, 1, 7)).toBe(0);
    expect(bandAt(0.99, 0, 1, 7)).toBe(6);
    expect(bandAt(0, 1 / 7, 1, 7)).toBe(1);
    expect(bandAt(0, -1 / 7, 1, 7)).toBe(6);
  });
});

describe('swell', () => {
  it('is widest at the swell and calm away from it', () => {
    expect(swell(0.5, 0.5, 0.2, 0.1)).toBeCloseTo(1.2);
    expect(swell(0.9, 0.1, 0.2, 0.1)).toBeCloseTo(1);
  });
});

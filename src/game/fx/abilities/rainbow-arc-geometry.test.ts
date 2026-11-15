import { describe, expect, it } from 'vitest';
import { arcCurve, bandAt, rimPolyline, swell } from './rainbow-arc-geometry';

describe('arcCurve', () => {
  it('has normals that point up and leans to the side of the end', () => {
    const pts = arcCurve({ x: 0, y: 100 }, { x: 200, y: 0 }, 0.2, 0.5, 1, 10);
    expect(pts.every((p) => p.ny < 0.01)).toBe(true);
    const left = arcCurve({ x: 200, y: 100 }, { x: 0, y: 0 }, 0.2, 0.5, 1, 10);
    expect(left.every((p) => p.ny < 0.01)).toBe(true);
  });
  it('has normals that point up and leans to the side of the end', () => {
    const pts = arcCurve({ x: 0, y: 100 }, { x: 200, y: 0 }, 0.2, 0.5, 1, 10);
    expect(pts.every((p) => p.ny < 0.01)).toBe(true);
    const left = arcCurve({ x: 200, y: 100 }, { x: 0, y: 0 }, 0.2, 0.5, 1, 10);
    expect(left.every((p) => p.ny < 0.01)).toBe(true);
  });
  it('runs from the start to the end and bulges up', () => {
    const pts = arcCurve({ x: 0, y: 100 }, { x: 200, y: 100 }, 0.5, 0, 1, 10);
    expect(pts[0]).toMatchObject({ x: 0, y: 100 });
    expect(pts[pts.length - 1]!.x).toBeCloseTo(200);
    expect(Math.min(...pts.map((p) => p.y))).toBeLessThan(100);
  });
  it('stops part way while it grows', () => {
    const pts = arcCurve({ x: 0, y: 0 }, { x: 200, y: 0 }, 0.3, 0, 0.5, 10);
    expect(pts[pts.length - 1]!.x).toBeLessThan(120);
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

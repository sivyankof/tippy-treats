import { describe, expect, it } from 'vitest';
import {
  domeShape,
  glossFromShares,
  openBodyLayout,
  roundRectPoints,
  topEdgeAt,
} from './plain-style';

const CORNER_POINTS = 7;

describe('roundRectPoints', () => {
  it('gives the same number of points for every corner', () => {
    expect(roundRectPoints(0, 0, 50, 30, 10)).toHaveLength(CORNER_POINTS * 4);
  });

  it('spans exactly the half sizes', () => {
    const pts = roundRectPoints(10, 20, 50, 30, 12);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-40);
    expect(Math.max(...xs)).toBeCloseTo(60);
    expect(Math.min(...ys)).toBeCloseTo(-10);
    expect(Math.max(...ys)).toBeCloseTo(50);
  });

  it('clamps the radius to the smaller half size', () => {
    const big = roundRectPoints(0, 0, 50, 30, 999);
    const fit = roundRectPoints(0, 0, 50, 30, 30);
    big.forEach((p, i) => {
      expect(p.x).toBeCloseTo(fit[i]?.x ?? NaN);
      expect(p.y).toBeCloseTo(fit[i]?.y ?? NaN);
    });
  });

  it('starts at the top left corner and goes clockwise', () => {
    const pts = roundRectPoints(0, 0, 50, 30, 10);
    const first = pts[0];
    const afterTopLeft = pts[CORNER_POINTS];
    const afterTopRight = pts[CORNER_POINTS * 2];
    expect(first && first.x).toBeLessThan(-35);
    expect(afterTopLeft && afterTopLeft.x).toBeGreaterThan(30);
    expect(afterTopLeft && afterTopLeft.y).toBeLessThan(-15);
    expect(afterTopRight && afterTopRight.y).toBeGreaterThan(15);
  });
});

describe('glossFromShares', () => {
  const spec = {
    x: -0.5,
    y: 0.25,
    length: 0.2,
    thick: 0.1,
    tiltDeg: 180,
    dotGap: 0.05,
    dotRadius: 0.02,
  };

  it('scales sizes by the unit and the offset by the reach', () => {
    const m = glossFromShares(spec, 10, 20, 100, 0xffffff, 0.5, { x: 40, y: 80 });
    expect(m.x).toBeCloseTo(-10);
    expect(m.y).toBeCloseTo(40);
    expect(m.length).toBeCloseTo(20);
    expect(m.dotRadius).toBeCloseTo(2);
    expect(m.tilt).toBeCloseTo(Math.PI);
    expect(m.alpha).toBe(0.5);
  });

  it('measures the offset in the unit when no reach is given', () => {
    const m = glossFromShares(spec, 0, 0, 100, 0xffffff, 1);
    expect(m.x).toBeCloseTo(-50);
    expect(m.y).toBeCloseTo(25);
  });
});

describe('domeShape', () => {
  const SIZE = 50;
  const HEIGHT = 30;
  const pts = domeShape(0.9, 0.2)(0, 0, SIZE, HEIGHT);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);

  it('spans exactly the half sizes', () => {
    expect(Math.min(...xs)).toBeCloseTo(-SIZE);
    expect(Math.max(...xs)).toBeCloseTo(SIZE);
    expect(Math.min(...ys)).toBeCloseTo(-HEIGHT);
    expect(Math.max(...ys)).toBeCloseTo(HEIGHT);
  });

  it('keeps the left side straight only below the middle', () => {
    const onLeftEdge = pts.filter((p) => p.x < -SIZE + 0.5).map((p) => p.y);
    expect(Math.min(...onLeftEdge)).toBeGreaterThan(-HEIGHT * 0.2);
  });
});

describe('topEdgeAt', () => {
  it('finds the top of a dome above a given x', () => {
    const dome = domeShape(1, 0.2)(0, 0, 50, 30);
    expect(topEdgeAt(dome, 0)).toBeCloseTo(-30, 0);
    expect(topEdgeAt(dome, 45)).toBeGreaterThan(-15);
  });

  it('is infinite outside the shape', () => {
    expect(topEdgeAt(domeShape(1, 0.2)(0, 0, 50, 30), 80)).toBe(Infinity);
  });
});

describe('openBodyLayout', () => {
  it('leaves room above the body for the back of the opening ring', () => {
    const l = openBodyLayout(200, 100, 0.2, 5, 10);
    expect(l.texW).toBe(220);
    expect(l.texH).toBe(100 + 20 + 25);
    expect(l.centerY).toBe(10 + 25 + 50);
    expect(l.origin.y).toBeCloseTo(l.centerY / l.texH);
  });
});

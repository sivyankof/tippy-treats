import { describe, expect, it } from 'vitest';
import { luma } from '../../../util/color';
import {
  domeShape,
  fillQuad,
  fillRibbon,
  glossFromShares,
  openBodyLayout,
  roundRectPoints,
  sleepyLidTone,
  topEdgeAt,
} from './plain-style';

const CORNER_POINTS = 7;

/** A stand-in for Graphics that records the triangles it is asked to fill. */
function triangleRecorder(): { g: Parameters<typeof fillQuad>[0]; triangles: number[][] } {
  const triangles: number[][] = [];
  const g = {
    fillTriangle: (...coords: number[]) => triangles.push(coords),
  } as unknown as Parameters<typeof fillQuad>[0];
  return { g, triangles };
}

describe('fillRibbon', () => {
  it('covers the band between two polylines with two triangles per step', () => {
    const { g, triangles } = triangleRecorder();
    const top = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const bottom = top.map((p) => ({ x: p.x, y: 4 }));
    fillRibbon(g, top, bottom);
    expect(triangles).toHaveLength(4);
    const area = triangles.reduce(
      (sum, [x0, y0, x1, y1, x2, y2]) =>
        sum + Math.abs((x1! - x0!) * (y2! - y0!) - (x2! - x0!) * (y1! - y0!)) / 2,
      0,
    );
    expect(area).toBe(80);
  });

  it('draws nothing for a single point', () => {
    const { g, triangles } = triangleRecorder();
    fillRibbon(g, [{ x: 0, y: 0 }], [{ x: 0, y: 1 }]);
    expect(triangles).toHaveLength(0);
  });
});

describe('fillQuad', () => {
  it('splits a quadrilateral into two triangles', () => {
    const { g, triangles } = triangleRecorder();
    fillQuad(g, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 });
    expect(triangles).toEqual([
      [0, 0, 4, 0, 4, 3],
      [0, 0, 4, 3, 0, 3],
    ]);
  });
});

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

describe('sleepyLidTone', () => {
  it('keeps a light or mid crust as it is', () => {
    expect(sleepyLidTone(0xf6c98c)).toBe(0xf6c98c);
    expect(sleepyLidTone(0xb57a52)).toBe(0xb57a52);
  });
  it('lifts a very dark crust, never past white, and a darker one lifts more', () => {
    const dark = sleepyLidTone(0x3a2418);
    const darker = sleepyLidTone(0x1a0f0a);
    expect(luma(dark)).toBeGreaterThan(luma(0x3a2418));
    expect(luma(darker) - luma(0x1a0f0a)).toBeGreaterThan(luma(dark) - luma(0x3a2418));
    expect(sleepyLidTone(0x000000)).toBeLessThan(0xffffff);
  });
});

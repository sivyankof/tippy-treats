import { describe, expect, it } from 'vitest';
import { layerBox } from '../layer-draw';
import {
  bandEdge,
  bandPolygon,
  bodySpan,
  sampleXs,
  spongeRows,
  starPoints,
  waveAt,
} from './rainbow-geometry';

const box = layerBox(300);

describe('bodySpan', () => {
  it('is the full height away from the sides and shorter at the rounded corners', () => {
    expect(bodySpan(box, 0)).toEqual({ top: box.innerTop, bottom: box.innerBottom });
    const edge = bodySpan(box, box.innerLeft);
    expect(edge.top).toBeGreaterThan(box.innerTop);
    expect(edge.bottom).toBeLessThan(box.innerBottom);
  });
});

describe('bandEdge', () => {
  const xs = sampleXs(box, 8);
  it('spans the body from side to side', () => {
    const edge = bandEdge(box, 0, true, xs);
    expect(edge[0]?.x).toBe(box.innerLeft);
    expect(edge[edge.length - 1]?.x).toBe(box.innerRight);
  });
  it('follows the wave and stays inside the body', () => {
    for (const y of [box.innerTop - 20, 0, box.innerBottom + 20]) {
      for (const p of bandEdge(box, y, true, xs)) {
        const span = bodySpan(box, p.x);
        expect(p.y).toBeGreaterThanOrEqual(span.top);
        expect(p.y).toBeLessThanOrEqual(span.bottom);
      }
    }
    const mid = bandEdge(box, 0, true, xs);
    expect(mid.some((p) => p.y !== 0)).toBe(true);
    expect(mid[3]?.y).toBeCloseTo(waveAt(mid[3]?.x ?? 0));
  });
  it('is straight when it is not waved', () => {
    expect(new Set(bandEdge(box, 0, false, xs).map((p) => p.y))).toEqual(new Set([0]));
  });
  it('joins two edges into one closed outline', () => {
    const top = bandEdge(box, -10, true, xs);
    const bottom = bandEdge(box, 10, true, xs);
    expect(bandPolygon(top, bottom)).toHaveLength(top.length + bottom.length);
  });
});

describe('starPoints', () => {
  it('has ten points, the first straight up', () => {
    const pts = starPoints(0, 0, 20, 0.5);
    expect(pts).toHaveLength(10);
    expect(pts[0]?.y).toBeCloseTo(-20);
    expect(pts[1] && Math.hypot(pts[1].x, pts[1].y)).toBeCloseTo(10);
  });
  it('takes the number of points', () => {
    const pts = starPoints(0, 0, 10, 0.25, 4);
    expect(pts).toHaveLength(8);
    expect(pts[2]?.x).toBeCloseTo(10);
  });
});

describe('spongeRows', () => {
  it('stacks the sponges top to bottom inside the room', () => {
    const rows = spongeRows(0, 100, 5);
    expect(rows).toHaveLength(5);
    expect(rows[0]!.top).toBeGreaterThanOrEqual(0);
    expect(rows[4]!.bottom).toBeLessThanOrEqual(100);
    expect(rows[1]!.top).toBeGreaterThan(rows[0]!.bottom);
  });
});

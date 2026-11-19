import { describe, expect, it } from 'vitest';
import { layerBox } from './layer-draw';
import { shadeSegments } from './overlap-shade';

describe('shadeSegments', () => {
  const box = layerBox(200);

  it('covers the overlap of two layers', () => {
    const s = shadeSegments(box, 0, 40, 100);
    expect(s.left).toBeNull();
    expect(s.middle).toEqual({ x0: -10, x1: box.innerRight - box.innerRadius });
    expect(s.right).toEqual({ x0: box.innerRight - box.innerRadius, x1: 90 });
  });

  it('has nothing when the layers do not touch horizontally', () => {
    const s = shadeSegments(box, 0, 400, 100);
    expect(s).toEqual({ middle: null, left: null, right: null });
  });

  it('stays inside the outline and splits at the rounded corners', () => {
    const s = shadeSegments(box, 0, 0, 400);
    expect(s.left).toEqual({ x0: box.innerLeft, x1: box.innerLeft + box.innerRadius });
    expect(s.right).toEqual({ x0: box.innerRight - box.innerRadius, x1: box.innerRight });
    expect(s.middle).toEqual({
      x0: box.innerLeft + box.innerRadius,
      x1: box.innerRight - box.innerRadius,
    });
  });

  it('puts a span inside one corner into that corner only', () => {
    const s = shadeSegments(box, 0, -90, 10);
    expect(s.middle).toBeNull();
    expect(s.left).not.toBeNull();
    expect(s.right).toBeNull();
  });
});

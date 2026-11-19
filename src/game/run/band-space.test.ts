import { describe, expect, it } from 'vitest';
import { toCanvasRegion } from './band-space';

describe('band space', () => {
  it('moves a region down by the top inset only', () => {
    const region = { x: 10, y: 20, width: 30, height: 40 };
    expect(toCanvasRegion(region, { top: 100, bottom: 50 })).toEqual({
      x: 10,
      y: 120,
      width: 30,
      height: 40,
    });
    expect(toCanvasRegion(region, { top: 0, bottom: 0 })).toEqual(region);
    expect(toCanvasRegion(null, { top: 100, bottom: 0 })).toBeNull();
  });
});

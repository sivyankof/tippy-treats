import { describe, expect, it } from 'vitest';
import { bandHeight, toCanvasRegion } from './band-space';

describe('band space', () => {
  it('takes both insets off the canvas height', () => {
    expect(bandHeight(2400, { top: 140, bottom: 80 })).toBe(2180);
    expect(bandHeight(1920, { top: 0, bottom: 0 })).toBe(1920);
  });

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

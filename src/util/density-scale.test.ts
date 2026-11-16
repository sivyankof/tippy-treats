import { describe, expect, it } from 'vitest';
import { cappedBackingSize } from './density-scale';

describe('cappedBackingSize', () => {
  const logical = { width: 1080, height: 2337 };

  it('keeps the logical size when the cap is above what the screen needs', () => {
    expect(cappedBackingSize(logical, 390, 3, 3)).toEqual(logical);
  });

  it('shrinks the canvas to the capped density', () => {
    expect(cappedBackingSize(logical, 390, 3, 2)).toEqual({ width: 780, height: 1688 });
    expect(cappedBackingSize(logical, 390, 3, 1)).toEqual({ width: 390, height: 844 });
  });

  it('never goes above the density of the device', () => {
    expect(cappedBackingSize(logical, 390, 1, 2)).toEqual({ width: 390, height: 844 });
  });

  it('keeps the logical size for a canvas that has no size yet', () => {
    expect(cappedBackingSize(logical, 0, 3, 1)).toEqual(logical);
  });
});

import { describe, expect, it } from 'vitest';
import { frameOf } from './safe-frame';

describe('frameOf', () => {
  it('is the whole canvas without a band', () => {
    expect(frameOf(2400, { top: 0, bottom: 0 })).toEqual({
      top: 0,
      bottom: 2400,
      height: 2400,
      centerY: 1200,
    });
  });

  it('leaves the band clear at both ends', () => {
    const frame = frameOf(2400, { top: 150, bottom: 90 });
    expect(frame).toEqual({ top: 150, bottom: 2310, height: 2160, centerY: 1230 });
  });

  it('never goes negative or inverted on an absurd band', () => {
    const frame = frameOf(100, { top: 80, bottom: 80 });
    expect(frame.height).toBe(0);
    expect(frame.bottom).toBeGreaterThanOrEqual(frame.top);
    expect(frameOf(100, { top: -5, bottom: -5 }).height).toBe(100);
  });
});

import { describe, expect, it } from 'vitest';
import { paddedOrigin, paddedScale, paddedSize } from './field-pad';

describe('field pad', () => {
  it('grows the picture on every side', () => {
    expect(paddedSize(44, 240, 4)).toEqual([52, 248]);
  });

  it('keeps the centre origin at the centre', () => {
    expect(paddedOrigin([0.5, 0.5], 44, 240, 4)).toEqual([0.5, 0.5]);
  });

  it('keeps the pivot on the same spot of the drawing', () => {
    const [ox, oy] = paddedOrigin([0.5, 0.05], 44, 240, 4);
    expect(ox * 52).toBeCloseTo(22 + 4);
    expect(oy * 248).toBeCloseTo(12 + 4);
  });

  it('scales a square picture by its grown size', () => {
    expect(paddedScale(160, 4)).toBeCloseTo(168 / 160);
  });

  it('takes a pad per side and matches the hand-worked topper and arrow values', () => {
    // The cherry: anchor at the middle of the width and at restY, field left 4, right 13, top 6, bottom 4.
    const [ox, oy] = paddedOrigin([0.5, 86 / 92], 66, 92, {
      left: 4,
      right: 13,
      top: 6,
      bottom: 4,
    });
    expect(ox).toBeCloseTo((66 / 2 + 4) / (66 + 4 + 13));
    expect(oy * (92 + 6 + 4)).toBeCloseTo(86 + 6);
    // The arrow: tip at the bottom, then at the top (flipped), with an even field.
    const shown = 150 + 2 * 9;
    expect(paddedOrigin([0.5, 1], 138, shown, 10)[1]).toBeCloseTo((10 + shown) / (shown + 20));
    expect(paddedOrigin([0.5, 0], 138, shown, 10)[1]).toBeCloseTo(10 / (shown + 20));
  });
});

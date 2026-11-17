import { describe, expect, it } from 'vitest';
import { paddedOrigin, paddedSize } from './field-pad';

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
});

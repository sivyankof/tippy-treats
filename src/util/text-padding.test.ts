import { describe, expect, it } from 'vitest';
import { textPadding } from './text-padding';

describe('textPadding', () => {
  it('needs nothing for plain text', () => {
    expect(textPadding(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('reaches half the stroke on every side', () => {
    expect(textPadding(8, 0, 0)).toEqual({ x: 4, y: 4 });
    expect(textPadding(5, 0, 0)).toEqual({ x: 3, y: 3 });
  });

  it('adds the shadow offset on top of the stroke, whichever way it points', () => {
    expect(textPadding(8, 0, 4)).toEqual({ x: 4, y: 8 });
    expect(textPadding(0, -3, -2)).toEqual({ x: 3, y: 2 });
  });
});

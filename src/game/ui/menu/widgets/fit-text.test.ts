import { describe, expect, it } from 'vitest';
import { fitScaleOf, sharedFitScale } from './fit-text';

describe('fit scales', () => {
  it('is 1 for a label that fits and shrinks one that does not', () => {
    expect(fitScaleOf(100, 200, 0.5)).toBe(1);
    expect(fitScaleOf(400, 200, 0.5)).toBe(0.5);
    expect(fitScaleOf(250, 200, 0.5)).toBeCloseTo(0.8);
    expect(fitScaleOf(0, 200, 0.5)).toBe(1);
  });

  it('never goes below the minimum', () => {
    expect(fitScaleOf(1000, 200, 0.7)).toBe(0.7);
  });

  it('gives a row of labels the smallest scale any of them needs', () => {
    expect(sharedFitScale([120, 130, 250], 200, 0.5)).toBeCloseTo(0.8);
    expect(sharedFitScale([120, 130, 150], 200, 0.5)).toBe(1);
    expect(sharedFitScale([], 200, 0.5)).toBe(1);
  });
});

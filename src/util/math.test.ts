import { describe, expect, it } from 'vitest';
import { randomSeed, TWO_PI, UINT32_RANGE } from './math';

describe('math helpers', () => {
  it('has a full turn of 2 pi', () => {
    expect(TWO_PI).toBeCloseTo(6.283185307, 8);
  });

  it('keeps random seeds inside the uint32 domain', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.5)).toBe(UINT32_RANGE / 2);
    expect(randomSeed(() => 1 - Number.EPSILON)).toBeLessThan(UINT32_RANGE);
    expect(Number.isInteger(randomSeed())).toBe(true);
  });
});

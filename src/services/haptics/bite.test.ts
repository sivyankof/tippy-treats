import { describe, expect, it } from 'vitest';
import { isBigBite } from './bite';

describe('isBigBite', () => {
  it('is false at or below the threshold', () => {
    expect(isBigBite(30, 100)).toBe(false);
    expect(isBigBite(5, 100)).toBe(false);
  });
  it('is true above the threshold', () => {
    expect(isBigBite(31, 100)).toBe(true);
  });
  it('is false for an empty layer', () => {
    expect(isBigBite(10, 0)).toBe(false);
  });
});

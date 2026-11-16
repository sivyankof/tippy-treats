import { describe, expect, it } from 'vitest';
import { nextUnbaked } from './collapse-scan';

describe('nextUnbaked', () => {
  it('finds the nearest layer below the floor without a picture', () => {
    const baked = new Set([9, 8, 7, 3]);
    expect(nextUnbaked(10, (i) => baked.has(i))).toBe(6);
    baked.add(6).add(5).add(4);
    expect(nextUnbaked(10, (i) => baked.has(i))).toBe(2);
  });

  it('ignores the layers from the floor up', () => {
    expect(nextUnbaked(5, (i) => i >= 5)).toBe(4);
  });

  it('is -1 when every layer below the floor has its picture, or there are none', () => {
    expect(nextUnbaked(4, () => true)).toBe(-1);
    expect(nextUnbaked(0, () => false)).toBe(-1);
  });
});

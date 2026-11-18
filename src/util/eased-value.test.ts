import { describe, expect, it } from 'vitest';
import { EasedValue } from './eased-value';

describe('EasedValue', () => {
  it('takes the first target as it is', () => {
    const eased = new EasedValue(100);
    expect(eased.value).toBe(0);
    expect(eased.follow(0.8, 16)).toBe(0.8);
    expect(eased.value).toBe(0.8);
  });

  it('then moves by at most deltaMs / easeMs a frame, never past the target', () => {
    const eased = new EasedValue(100);
    eased.follow(0, 16);
    expect(eased.follow(1, 25)).toBeCloseTo(0.25);
    expect(eased.follow(1, 25)).toBeCloseTo(0.5);
    expect(eased.follow(0.4, 25)).toBeCloseTo(0.4);
    expect(eased.follow(1, 1000)).toBe(1);
  });

  it('holds still on a frame of no time', () => {
    const eased = new EasedValue(100);
    eased.follow(0.3, 16);
    expect(eased.follow(1, 0)).toBe(0.3);
  });
});

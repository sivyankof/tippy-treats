import { describe, expect, it } from 'vitest';
import { duckFactor, musicTarget, type DuckReason } from './mixer-math';

describe('duck level', () => {
  it('is 1 with no reason and 1 - share with any', () => {
    expect(duckFactor(new Set<DuckReason>(), 0.4)).toBe(1);
    expect(duckFactor(new Set<DuckReason>(['window']), 0.4)).toBeCloseTo(0.6);
  });

  it('does not stack reasons', () => {
    expect(duckFactor(new Set<DuckReason>(['window', 'record']), 0.4)).toBeCloseTo(0.6);
  });

  it('gives the music bus target', () => {
    const none = new Set<DuckReason>();
    expect(musicTarget(true, 0.5, none, 0.4)).toBe(0.5);
    expect(musicTarget(true, 0.5, new Set<DuckReason>(['record']), 0.4)).toBeCloseTo(0.3);
    expect(musicTarget(false, 0.5, none, 0.4)).toBe(0);
  });
});

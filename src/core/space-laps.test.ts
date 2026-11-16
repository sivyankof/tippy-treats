import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { ZONE_RULES } from '../data/zones';
import { spaceLap, spaceWidthLimit } from './space-laps';

const { maxWidth } = BALANCE.layer;

describe('spaceLap', () => {
  it('counts laps of 20 layers from layer 101', () => {
    expect(spaceLap(1)).toBe(0);
    expect(spaceLap(100)).toBe(0);
    expect(spaceLap(101)).toBe(1);
    expect(spaceLap(120)).toBe(1);
    expect(spaceLap(121)).toBe(2);
    expect(spaceLap(140)).toBe(2);
    expect(spaceLap(141)).toBe(3);
  });
});

describe('spaceWidthLimit', () => {
  it('keeps the full width before Space and on the first lap', () => {
    for (const index of [1, 50, 100, 101, 120]) expect(spaceWidthLimit(index)).toBe(maxWidth);
  });

  it('shrinks by an equal step per lap from lap 2', () => {
    const { step } = ZONE_RULES.spaceLaps;
    const lap = (n: number): number => spaceWidthLimit(101 + (n - 1) * 20);
    expect(lap(2)).toBeCloseTo((1 - step) * maxWidth);
    expect(lap(2) - lap(3)).toBeCloseTo(step * maxWidth);
    expect(lap(3) - lap(4)).toBeCloseTo(step * maxWidth);
  });

  it('never goes below the floor', () => {
    const { floor } = ZONE_RULES.spaceLaps;
    expect(spaceWidthLimit(100_000)).toBeCloseTo(floor * maxWidth);
    let previous = Infinity;
    for (let index = 101; index < 2000; index += 20) {
      const limit = spaceWidthLimit(index);
      expect(limit).toBeLessThanOrEqual(previous);
      expect(limit).toBeGreaterThanOrEqual(floor * maxWidth - 1e-9);
      previous = limit;
    }
  });

  it('matches the example of docs/02 for a 6% step and a 50% floor', () => {
    const shares = Array.from({ length: 11 }, (_, i) =>
      Math.round((spaceWidthLimit(101 + i * 20, { step: 0.06, floor: 0.5 }) / maxWidth) * 100),
    );
    expect(shares).toEqual([
      100, 94, 88, 82, 76, 70, 64, 58, 52, 50, 50,
    ]);
  });
});

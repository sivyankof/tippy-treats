import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { ZONE_RULES } from '../data/zones';
import { LAP_REWARD } from '../data/zones';
import {
  flyingLap,
  lapRewardBerries,
  lapScoreBonus,
  layerZoneScoreMult,
  spaceLap,
  spaceWidthLimit,
} from './space-laps';

const { maxWidth } = BALANCE.layer;

describe('flyingLap', () => {
  it('is the lap of the next layer to fly', () => {
    expect(flyingLap(99)).toBe(0);
    expect(flyingLap(100)).toBe(1);
    expect(flyingLap(119)).toBe(1);
    expect(flyingLap(120)).toBe(2);
  });
});

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
    expect(shares).toEqual([100, 94, 88, 82, 76, 70, 64, 58, 52, 50, 50]);
  });
});

describe('lapScoreBonus', () => {
  it('is 0 outside Space and on lap 1, then grows by 0.1 per lap up to +1', () => {
    expect(lapScoreBonus(0)).toBe(0);
    expect(lapScoreBonus(1)).toBe(0);
    expect(lapScoreBonus(2)).toBeCloseTo(0.1);
    expect(lapScoreBonus(6)).toBeCloseTo(0.5);
    expect(lapScoreBonus(11)).toBeCloseTo(1);
    expect(lapScoreBonus(40)).toBe(1);
  });

  it('adds to the zone multiplier of the layer', () => {
    expect(layerZoneScoreMult(100, 2.2)).toBe(2.2);
    expect(layerZoneScoreMult(120, 2.5)).toBe(2.5);
    expect(layerZoneScoreMult(121, 2.5)).toBeCloseTo(2.6);
    expect(layerZoneScoreMult(10_000, 2.5)).toBeCloseTo(3.5);
  });
});

describe('lapRewardBerries', () => {
  const { berries } = LAP_REWARD;

  it('pays nothing before lap 2 and for laps already reached', () => {
    expect(lapRewardBerries(0, 100)).toBe(0);
    expect(lapRewardBerries(1, 140 - 20)).toBe(0);
    expect(lapRewardBerries(3, 150)).toBe(0);
  });

  it('pays once for each new lap from 2 to 10', () => {
    expect(lapRewardBerries(1, 121)).toBe(berries);
    expect(lapRewardBerries(0, 141)).toBe(2 * berries);
    expect(lapRewardBerries(2, 200)).toBe(3 * berries);
  });

  it('stops at the last rewarded lap', () => {
    expect(lapRewardBerries(0, 5000)).toBe(9 * berries);
    expect(lapRewardBerries(10, 5000)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { SPACE_PLANET_IDS } from '../data/space-planets';
import { LapChangeWatch, planetOfLap, planetPassOf, planetSeedOf } from './space-planet';
import { spaceLap } from './space-laps';

describe('planetOfLap', () => {
  const seeds = [1, 2, 3, 42, 777, 123456];

  it('shows all nine planets once in every block of nine laps', () => {
    for (const seed of seeds) {
      for (let block = 0; block < 6; block++) {
        const ids = Array.from({ length: 9 }, (_, i) => planetOfLap(seed, block * 9 + i + 1));
        expect(new Set(ids).size).toBe(9);
        expect([...ids].sort()).toEqual([...SPACE_PLANET_IDS].sort());
      }
    }
  });

  it('never repeats a planet on the next lap, block borders included', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (let lap = 1; lap < 60; lap++) {
        expect(planetOfLap(seed, lap + 1)).not.toBe(planetOfLap(seed, lap));
      }
    }
  });

  it('is a pure function of the seed and the lap, and differs between seeds', () => {
    expect(planetOfLap(5, 4)).toBe(planetOfLap(5, 4));
    const orders = new Set(
      seeds.map((seed) => Array.from({ length: 9 }, (_, i) => planetOfLap(seed, i + 1)).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('takes lap 0 or less for the first lap', () => {
    expect(planetOfLap(9, 0)).toBe(planetOfLap(9, 1));
    expect(planetOfLap(9, -3)).toBe(planetOfLap(9, 1));
  });

  it('follows spaceLap of a layer index', () => {
    expect(planetOfLap(8, spaceLap(101))).toBe(planetOfLap(8, 1));
    expect(planetOfLap(8, spaceLap(121))).toBe(planetOfLap(8, 2));
  });

  it('draws the planet stream from the run seed alone', () => {
    expect(planetSeedOf(12)).toBe(planetSeedOf(12));
    expect(planetSeedOf(12)).not.toBe(planetSeedOf(13));
  });
});

describe('planetPassOf', () => {
  it('alternates the side lap by lap and keeps the entry draw in range', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (let lap = 1; lap < 20; lap++) {
        const pass = planetPassOf(seed, lap);
        expect(pass.side).not.toBe(planetPassOf(seed, lap + 1).side);
        expect(pass.enter).toBeGreaterThanOrEqual(0);
        expect(pass.enter).toBeLessThan(1);
      }
    }
  });

  it('starts on either side and varies the entry by seed', () => {
    const sides = new Set<number>();
    const enters = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      sides.add(planetPassOf(seed, 1).side);
      enters.add(planetPassOf(seed, 1).enter);
    }
    expect(sides.size).toBe(2);
    expect(enters.size).toBeGreaterThan(30);
  });
});

describe('LapChangeWatch', () => {
  it('announces nothing at the start, whatever the lap', () => {
    const watch = new LapChangeWatch(2);
    expect(watch.observe(null)).toBeNull();
    expect(watch.observe(5)).toBeNull();
    expect(watch.observe(5)).toBeNull();
  });

  it('announces a higher lap from lap 2 on, once', () => {
    const watch = new LapChangeWatch(2);
    watch.observe(0);
    expect(watch.observe(1)).toBeNull();
    expect(watch.observe(2)).toBe(2);
    expect(watch.observe(2)).toBeNull();
    expect(watch.observe(3)).toBe(3);
  });

  it('resets silently when the lap goes down (restart)', () => {
    const watch = new LapChangeWatch(2);
    watch.observe(4);
    expect(watch.observe(0)).toBeNull();
    expect(watch.observe(1)).toBeNull();
    expect(watch.observe(2)).toBe(2);
  });
});

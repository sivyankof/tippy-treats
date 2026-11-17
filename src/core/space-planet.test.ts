import { describe, expect, it } from 'vitest';
import { SPACE_PLANET_IDS, type SpacePlanetId } from '../data/space-planets';
import {
  LapChangeWatch,
  PlanetWalk,
  planetOfLap,
  planetPassOf,
  planetSeedOf,
  type PlanetFits,
} from './space-planet';
import { spaceLap } from './space-laps';

describe('planetOfLap', () => {
  const seeds = [1, 2, 3, 42, 777, 123456];
  const everywhere: PlanetFits = () => true;
  /** Three planets (the ringed ones) fit only from lap 4, like the wide planets of Space. */
  const WIDE: SpacePlanetId[] = ['donut_ring', 'mint_candy', 'truffle_hole'];
  const wideLater: PlanetFits = (id, lap) => lap >= 4 || !WIDE.includes(id);
  const lapsOf = (seed: number, fits: PlanetFits, count: number): (SpacePlanetId | null)[] =>
    Array.from({ length: count }, (_, i) => planetOfLap(seed, i + 1, fits));

  it('a kept walk gives the same picks as a replay, in any order of asking', () => {
    for (const seed of seeds) {
      const walk = new PlanetWalk(seed, wideLater);
      for (const lap of [7, 2, 19, 1, 4, 30, 5]) {
        expect(walk.pick(lap)).toBe(planetOfLap(seed, lap, wideLater));
      }
    }
  });

  it('shows all nine planets once in every block of nine laps when all fit', () => {
    for (const seed of seeds) {
      for (let block = 0; block < 6; block++) {
        const ids = lapsOf(seed, everywhere, (block + 1) * 9).slice(block * 9);
        expect([...ids].sort()).toEqual([...SPACE_PLANET_IDS].sort());
      }
    }
  });

  it('never repeats a planet on the next lap, block borders included', () => {
    for (let seed = 0; seed < 200; seed++) {
      const ids = lapsOf(seed, wideLater, 50);
      for (let lap = 1; lap < ids.length; lap++) expect(ids[lap]).not.toBe(ids[lap - 1]);
    }
  });

  it('gives every lap a planet when any fits, and none when nothing does', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const id of lapsOf(seed, wideLater, 40)) expect(id).not.toBeNull();
    }
    expect(planetOfLap(4, 3, () => false)).toBeNull();
    // Only lap 1 has no room: it is empty, the rest are not.
    const lateOnly: PlanetFits = (_id, lap) => lap > 1;
    expect(planetOfLap(4, 1, lateOnly)).toBeNull();
    expect(planetOfLap(4, 2, lateOnly)).not.toBeNull();
  });

  it('defers a planet that does not fit and shows it on a later lap, no repeats until all nine are shown', () => {
    for (let seed = 0; seed < 200; seed++) {
      const ids = lapsOf(seed, wideLater, 30);
      // Walk the laps: a block is closed when all nine were shown; inside it no planet comes twice.
      let shown = new Set<SpacePlanetId | null>();
      for (const id of ids) {
        expect(shown.has(id), `seed ${seed}`).toBe(false);
        shown.add(id);
        if (shown.size === SPACE_PLANET_IDS.length) shown = new Set();
      }
      // The wide planets are not shown on laps 2 and 3.
      expect(WIDE).not.toContain(ids[1]);
      expect(WIDE).not.toContain(ids[2]);
    }
  });

  it('takes a planet that was shown when only shown ones fit, instead of an empty lap', () => {
    const only: PlanetFits = (id, lap) => (lap < 3 ? true : id === 'cookie');
    for (let seed = 0; seed < 50; seed++) expect(planetOfLap(seed, 6, only)).toBe('cookie');
  });

  it('is a pure function of the seed, the lap and the fit, and differs between seeds', () => {
    expect(planetOfLap(5, 4, wideLater)).toBe(planetOfLap(5, 4, wideLater));
    const orders = new Set(seeds.map((seed) => lapsOf(seed, everywhere, 9).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('takes lap 0 or less for the first lap', () => {
    expect(planetOfLap(9, 0, everywhere)).toBe(planetOfLap(9, 1, everywhere));
    expect(planetOfLap(9, -3, everywhere)).toBe(planetOfLap(9, 1, everywhere));
  });

  it('follows spaceLap of a layer index', () => {
    expect(planetOfLap(8, spaceLap(101), everywhere)).toBe(planetOfLap(8, 1, everywhere));
    expect(planetOfLap(8, spaceLap(121), everywhere)).toBe(planetOfLap(8, 2, everywhere));
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

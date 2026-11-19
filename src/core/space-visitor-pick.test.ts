import { describe, expect, it } from 'vitest';
import { SPACE_VISITOR, SPACE_VISITOR_IDS } from '../data/guests/space-visitor';
import { Rng } from './rng';
import { pickGuest, visitorOfLap, visitorPassRng, visitorSeedOf } from './space-visitor-pick';

const LAPS = 400;

describe('visitorOfLap', () => {
  it('is the same for the same seed and lap', () => {
    for (let lap = 1; lap <= 30; lap++) {
      expect(visitorOfLap(77, lap)).toBe(visitorOfLap(77, lap));
    }
  });

  it('differs between seeds', () => {
    const a = Array.from({ length: 40 }, (_, i) => visitorOfLap(1, i + 1));
    const b = Array.from({ length: 40 }, (_, i) => visitorOfLap(2, i + 1));
    expect(a).not.toEqual(b);
  });

  it('gives a guest on about half of many laps', () => {
    let guests = 0;
    let total = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (let lap = 1; lap <= LAPS / 20; lap++) {
        total++;
        if (visitorOfLap(seed, lap) !== null) guests++;
      }
    }
    const share = guests / total;
    expect(share).toBeGreaterThan(SPACE_VISITOR.chancePerLap - 0.07);
    expect(share).toBeLessThan(SPACE_VISITOR.chancePerLap + 0.07);
  });

  it('never repeats the guest that crossed last', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let last: string | null = null;
      for (let lap = 1; lap <= 60; lap++) {
        const guest = visitorOfLap(seed, lap);
        if (guest === null) continue;
        expect(guest).not.toBe(last);
        last = guest;
      }
    }
  });

  it('shows every guest over many laps', () => {
    const seen = new Set<string>();
    for (let lap = 1; lap <= LAPS; lap++) {
      const guest = visitorOfLap(5, lap);
      if (guest) seen.add(guest);
    }
    expect([...seen].sort()).toEqual([...SPACE_VISITOR_IDS].sort());
  });

  it('counts lap 0 as lap 1', () => {
    expect(visitorOfLap(9, 0)).toBe(visitorOfLap(9, 1));
  });
});

describe('visitor streams', () => {
  it('are named streams of the seed and leave the run stream alone', () => {
    const run = new Rng(123);
    const before = run.next();
    const again = new Rng(123);
    visitorOfLap(visitorSeedOf(123), 12);
    visitorPassRng(visitorSeedOf(123), 3).next();
    expect(again.next()).toBe(before);
    expect(visitorSeedOf(123)).not.toBe(new Rng(123).fork('planets').seed);
  });

  it('pass details differ from lap to lap and repeat for one lap', () => {
    const seed = visitorSeedOf(8);
    expect(visitorPassRng(seed, 2).next()).toBe(visitorPassRng(seed, 2).next());
    expect(visitorPassRng(seed, 2).next()).not.toBe(visitorPassRng(seed, 3).next());
  });
});

describe('pickGuest', () => {
  it('reaches every guest by the roll', () => {
    const seen = new Set(Array.from({ length: 100 }, (_, i) => pickGuest(i / 100)));
    expect([...seen].sort()).toEqual([...SPACE_VISITOR_IDS].sort());
  });

  it('only takes from the given ones', () => {
    for (let i = 0; i < 100; i++)
      expect(pickGuest(i / 100, ['comet', 'saucer'])).not.toBe('eclair');
  });
});

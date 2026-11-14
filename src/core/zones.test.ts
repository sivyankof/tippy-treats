import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import {
  SHOWCASE_ZONE_INDEX,
  SPACE_RULE_POOL,
  SPACE_ZONE_INDEX,
  ZONE_RULES,
  ZONES,
} from '../data/zones';
import { layerSpeed } from './drop';
import { Rng } from './rng';
import {
  cloudRoll,
  layerRules,
  nominalSpeed,
  rushIndices,
  zoneIndexOf,
  zoneOf,
  zoneStartIndex,
} from './zones';

const zonesRng = (seed: number): Rng => new Rng(seed).fork('zones');
const SEEDS = Array.from({ length: 300 }, (_, i) => 1000 + i * 7919);
const LEN = BALANCE.zones.length;
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('zone table', () => {
  it('lists the six zones with the numbers of the design document', () => {
    expect(ZONES.map((z) => [z.id, z.speedMult, z.scoreMult])).toEqual([
      ['kitchen', 1, 1],
      ['showcase', 1, 1.2],
      ['roof', 1.05, 1.5],
      ['clouds', 1.05, 1.8],
      ['stars', 1.1, 2.2],
      ['space', 1.15, 2.5],
    ]);
    expect(ZONES.map((z) => z.rule)).toEqual([
      'none',
      'showcase',
      'roof',
      'clouds',
      'stars',
      'random',
    ]);
    expect(ZONES.filter((z) => z.speedCap !== null).map((z) => z.id)).toEqual(['space']);
  });

  it('maps layer indices to zones, the last zone going on forever', () => {
    const table: Array<[number, number]> = [
      [1, 0],
      [20, 0],
      [21, 1],
      [40, 1],
      [41, 2],
      [60, 2],
      [61, 3],
      [80, 3],
      [81, 4],
      [100, 4],
      [101, 5],
      [102, 5],
      [5000, 5],
    ];
    for (const [index, zone] of table) expect(zoneIndexOf(index)).toBe(zone);
    expect(zoneOf(45).id).toBe('roof');
    expect(zoneStartIndex(3)).toBe(61);
    expect(zoneIndexOf(0)).toBe(0);
  });
});

describe('nominalSpeed', () => {
  it('is the plain layer speed in the kitchen', () => {
    expect(nominalSpeed(0, 0, 1)).toBe(layerSpeed(0, 1));
    expect(nominalSpeed(15, 0, 1)).toBe(layerSpeed(15, 1));
  });

  it('multiplies by the zone and does not cap outside Space', () => {
    expect(nominalSpeed(30, 1, 1)).toBeCloseTo(layerSpeed(30, 1));
    expect(nominalSpeed(50, 2, 1)).toBeCloseTo(layerSpeed(50, 1) * 1.05);
    // 1392 * 1.1 is above the Space cap of 1400 and still allowed in the stars zone.
    expect(nominalSpeed(88, 4, 1)).toBeCloseTo(1392 * 1.1);
  });

  it('caps the base at 1400 in every zone, so Space is slower than late Stars', () => {
    expect(layerSpeed(89, 1)).toBe(BALANCE.speed.max);
    // Stars: the base is already at 1400 from height 89 and the zone multiplier lifts it above.
    expect(nominalSpeed(95, 4, 1)).toBeCloseTo(BALANCE.speed.max * 1.1);
    expect(nominalSpeed(99, 4, 1)).toBeCloseTo(1540);
    // Space: base times 1.15 is capped back to 1400, so its multiplier changes nothing.
    expect(nominalSpeed(100, SPACE_ZONE_INDEX, 1)).toBe(1400);
    expect(nominalSpeed(100, SPACE_ZONE_INDEX, 1)).toBeLessThan(nominalSpeed(99, 4, 1));
  });

  it('caps base times zone in Space, and abilities come on top of the cap', () => {
    expect(nominalSpeed(100, SPACE_ZONE_INDEX, 1)).toBe(BALANCE.speed.max);
    expect(nominalSpeed(400, SPACE_ZONE_INDEX, 1)).toBe(BALANCE.speed.max);
    expect(nominalSpeed(100, SPACE_ZONE_INDEX, 1.2)).toBeCloseTo(BALANCE.speed.max * 1.2);
    expect(nominalSpeed(100, SPACE_ZONE_INDEX, 0.8)).toBeCloseTo(BALANCE.speed.max * 0.8);
  });
});

describe('rush schedule', () => {
  it('starts 4-6 layers into the showcase zone and goes on every 4-6 layers, inside the zone', () => {
    const start = zoneStartIndex(SHOWCASE_ZONE_INDEX);
    const end = start + LEN - 1;
    const [min, max] = ZONE_RULES.rush.gap;
    for (const seed of SEEDS) {
      const indices = rushIndices(zonesRng(seed));
      expect(indices.length).toBeGreaterThanOrEqual(3);
      expect(indices[0]).toBeGreaterThanOrEqual(start - 1 + min);
      expect(indices[0]).toBeLessThanOrEqual(start - 1 + max);
      for (const [i, index] of indices.entries()) {
        expect(index).toBeGreaterThanOrEqual(start);
        expect(index).toBeLessThanOrEqual(end);
        if (i > 0) {
          const gap = index - (indices[i - 1] ?? 0);
          expect(gap).toBeGreaterThanOrEqual(min);
          expect(gap).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('flags exactly the scheduled layers, and only inside zone 2 outside Space', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const rng = zonesRng(seed);
      const scheduled = new Set(rushIndices(rng));
      for (const index of range(1, 100)) {
        expect(layerRules(rng, index).rush).toBe(scheduled.has(index));
      }
    }
  });

  it('depends on the seed', () => {
    const schedules = new Set(SEEDS.map((seed) => rushIndices(zonesRng(seed)).join(',')));
    expect(schedules.size).toBeGreaterThan(20);
  });
});

describe('layer rules', () => {
  it('gives the same schedule for the same seed, in any order of asking', () => {
    const indices = range(1, 160);
    for (const seed of SEEDS.slice(0, 30)) {
      const forward = indices.map((i) => layerRules(zonesRng(seed), i));
      const backward = [...indices]
        .reverse()
        .map((i) => layerRules(zonesRng(seed), i))
        .reverse();
      expect(backward).toEqual(forward);
    }
  });

  it('differs between seeds', () => {
    const fingerprint = (seed: number): string =>
      range(21, 160)
        .map((i) => {
          const r = layerRules(zonesRng(seed), i);
          return `${r.rule}${r.fromLeft ? 'L' : 'R'}${r.rush ? '!' : ''}${r.fakeoutX ?? ''}`;
        })
        .join('|');
    expect(new Set(SEEDS.map(fingerprint)).size).toBe(SEEDS.length);
  });

  it('carries index, zone and rule: no rule in the kitchen, zone rules in zones 2 to 5', () => {
    const rng = zonesRng(5);
    expect(range(1, 20).map((i) => layerRules(rng, i).rule)).toEqual(Array(20).fill('none'));
    expect(layerRules(rng, 30)).toMatchObject({ index: 30, zoneIndex: 1, rule: 'showcase' });
    expect(layerRules(rng, 50).rule).toBe('roof');
    expect(layerRules(rng, 70).rule).toBe('clouds');
    expect(layerRules(rng, 90).rule).toBe('stars');
  });

  it('spawns by index parity except under the showcase rule, where the side is random', () => {
    const rng = zonesRng(77);
    for (const index of [...range(1, 20), ...range(41, 100)]) {
      if (layerRules(rng, index).rule === 'showcase') continue;
      expect(layerRules(rng, index).fromLeft).toBe(index % 2 === 1);
    }
    const sides = SEEDS.flatMap((seed) =>
      range(21, 40).map((i) => layerRules(zonesRng(seed), i).fromLeft),
    );
    const lefts = sides.filter(Boolean).length / sides.length;
    expect(lefts).toBeGreaterThan(0.45);
    expect(lefts).toBeLessThan(0.55);
    // Not the parity pattern: some seed puts two layers in a row on the same side.
    const parityOnly = SEEDS.every((seed) =>
      range(21, 40).every((i) => layerRules(zonesRng(seed), i).fromLeft === (i % 2 === 1)),
    );
    expect(parityOnly).toBe(false);
  });

  it('rolls a fake-out for about 30% of the stars layers, inside 20-80% of the track', () => {
    const { minCenterX, maxCenterX } = BALANCE.layer;
    const [lo, hi] = ZONE_RULES.stars.pointRange;
    const rolls = SEEDS.flatMap((seed) => range(81, 100).map((i) => layerRules(zonesRng(seed), i)));
    const fakeouts = rolls.filter((r) => r.fakeoutX !== null);
    const share = fakeouts.length / rolls.length;
    expect(share).toBeGreaterThan(0.26);
    expect(share).toBeLessThan(0.34);
    for (const r of fakeouts) {
      const u = ((r.fakeoutX ?? 0) - minCenterX) / (maxCenterX - minCenterX);
      expect(u).toBeGreaterThanOrEqual(lo);
      expect(u).toBeLessThanOrEqual(hi);
    }
    const outside = SEEDS.flatMap((seed) =>
      range(1, 80).map((i) => layerRules(zonesRng(seed), i).fakeoutX),
    );
    expect(outside.every((x) => x === null)).toBe(true);
  });

  describe('Space', () => {
    const rolls = SEEDS.flatMap((seed) =>
      range(101, 160).map((i) => layerRules(zonesRng(seed), i)),
    );

    it('gives every layer exactly one rule of the pool, all four in use', () => {
      for (const r of rolls) expect(SPACE_RULE_POOL).toContain(r.rule);
      expect(new Set(rolls.map((r) => r.rule)).size).toBe(SPACE_RULE_POOL.length);
      for (const rule of SPACE_RULE_POOL) {
        const share = rolls.filter((r) => r.rule === rule).length / rolls.length;
        expect(share).toBeGreaterThan(0.2);
        expect(share).toBeLessThan(0.3);
      }
    });

    it('always fires the chosen rule: rush, fake-out and first-pass cloud are guaranteed', () => {
      for (const r of rolls) {
        expect(r.rush).toBe(r.rule === 'showcase');
        expect(r.fakeoutX !== null).toBe(r.rule === 'stars');
        const first = cloudRoll(zonesRng(1), { ...r }, 1);
        expect(first !== null).toBe(r.rule === 'clouds');
      }
    });

    it('chooses sides at random only for the showcase rule', () => {
      for (const r of rolls.slice(0, 500)) {
        if (r.rule !== 'showcase') expect(r.fromLeft).toBe(r.index % 2 === 1);
      }
    });
  });
});

describe('cloudRoll', () => {
  const cloudLayer = (seed: number, index: number) => ({
    rng: zonesRng(seed),
    rules: layerRules(zonesRng(seed), index),
  });

  it('is a pure function of seed, layer and pass', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const { rng, rules } = cloudLayer(seed, 70);
      const passes = range(1, 8).map((pass) => cloudRoll(rng, rules, pass));
      const again = range(1, 8)
        .reverse()
        .map((pass) => cloudRoll(zonesRng(seed), rules, pass))
        .reverse();
      expect(again).toEqual(passes);
    }
  });

  it('rolls nothing outside cloud layers', () => {
    const rng = zonesRng(3);
    for (const index of [5, 30, 50, 90]) {
      expect(cloudRoll(rng, layerRules(rng, index), 1)).toBeNull();
    }
  });

  it('comes in 50% of the passes with 300-500 ms of cover starting 15-60% into the pass', () => {
    const [coverMin, coverMax] = ZONE_RULES.clouds.coverMs;
    const [startMin, startMax] = ZONE_RULES.clouds.startProgress;
    const rolls = SEEDS.flatMap((seed) =>
      range(61, 80).flatMap((index) => {
        const { rng, rules } = cloudLayer(seed, index);
        return range(1, 3).map((pass) => cloudRoll(rng, rules, pass));
      }),
    );
    const clouds = rolls.filter((r) => r !== null);
    expect(clouds.length / rolls.length).toBeGreaterThan(0.46);
    expect(clouds.length / rolls.length).toBeLessThan(0.54);
    for (const cloud of clouds) {
      expect(cloud.coverMs).toBeGreaterThanOrEqual(coverMin);
      expect(cloud.coverMs).toBeLessThanOrEqual(coverMax);
      expect(cloud.startProgress).toBeGreaterThanOrEqual(startMin);
      expect(cloud.startProgress).toBeLessThanOrEqual(startMax);
    }
  });

  it('differs between seeds and between passes', () => {
    const covers = new Set(
      SEEDS.map((seed) => {
        const { rng, rules } = cloudLayer(seed, 70);
        return range(1, 6)
          .map((pass) => cloudRoll(rng, rules, pass)?.coverMs ?? 0)
          .join(',');
      }),
    );
    expect(covers.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('guarantees a cloud on the first pass of a Space cloud layer, 50% on later passes', () => {
    let later = 0;
    let laterClouds = 0;
    for (const seed of SEEDS) {
      for (const index of range(101, 140)) {
        const rng = zonesRng(seed);
        const rules = layerRules(rng, index);
        if (rules.rule !== 'clouds') continue;
        expect(cloudRoll(rng, rules, 1)).not.toBeNull();
        for (const pass of [2, 3]) {
          later++;
          if (cloudRoll(rng, rules, pass)) laterClouds++;
        }
      }
    }
    expect(laterClouds / later).toBeGreaterThan(0.44);
    expect(laterClouds / later).toBeLessThan(0.56);
  });
});

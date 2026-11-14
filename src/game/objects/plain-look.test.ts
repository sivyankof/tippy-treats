import { describe, expect, it } from 'vitest';
import { DECOR_KINDS, PLAIN_LAYER, PLAIN_PAIRS, SPONGES } from '../../data/plain-layers';
import {
  cosmeticSeedOf,
  GOLDEN_LOOK,
  lookCode,
  lookOfCode,
  pairAt,
  plainLookAt,
  plainLooks,
} from './plain-look';

const LAYERS = 400;

describe('plain layer pairs and decorations', () => {
  it('has 8 to 10 pairs of the three sponges, each with its own decorations', () => {
    expect(PLAIN_PAIRS.length).toBeGreaterThanOrEqual(8);
    expect(PLAIN_PAIRS.length).toBeLessThanOrEqual(10);
    expect(new Set(PLAIN_PAIRS.map((p) => p.sponge))).toEqual(new Set(Object.keys(SPONGES)));
    for (const pair of PLAIN_PAIRS) {
      expect(pair.decor.length).toBeGreaterThan(0);
      for (const kind of pair.decor) expect(DECOR_KINDS).toContain(kind);
    }
  });

  it('picks the same look for the same seed and layer, whatever was asked before', () => {
    const seed = cosmeticSeedOf(5);
    const first = Array.from({ length: 50 }, (_, i) => plainLookAt(seed, i + 1));
    const backwards = Array.from({ length: 50 }, (_, i) => plainLookAt(seed, 50 - i)).reverse();
    expect(backwards).toEqual(first);
  });

  it('gives another seed another tower', () => {
    const a = Array.from({ length: 30 }, (_, i) => lookCode(plainLookAt(cosmeticSeedOf(1), i + 1)));
    const b = Array.from({ length: 30 }, (_, i) => lookCode(plainLookAt(cosmeticSeedOf(2), i + 1)));
    expect(a).not.toEqual(b);
  });

  it('never repeats a pair on neighbouring layers and uses every pair', () => {
    for (const run of [0, 5, 77, 123456]) {
      const seed = cosmeticSeedOf(run);
      const used = new Set<number>();
      for (let i = 1; i <= LAYERS; i++) {
        const pair = pairAt(seed, i);
        used.add(pair);
        if (i > 1) expect(pair).not.toBe(pairAt(seed, i - 1));
      }
      expect(used.size).toBe(PLAIN_PAIRS.length);
    }
  });

  it('decorates about the share in the data, only with what suits the pair', () => {
    const seed = cosmeticSeedOf(42);
    let decorated = 0;
    for (let i = 1; i <= LAYERS; i++) {
      const look = plainLookAt(seed, i);
      if (!look.decor) continue;
      decorated++;
      expect(PLAIN_PAIRS[look.pair]!.decor).toContain(look.decor);
    }
    expect(decorated / LAYERS).toBeGreaterThan(PLAIN_LAYER.decorShare - 0.1);
    expect(decorated / LAYERS).toBeLessThan(PLAIN_LAYER.decorShare + 0.1);
  });

  it('round-trips a look through its code; the golden code is none of them', () => {
    const codes = new Set<number>();
    PLAIN_PAIRS.forEach((_, pair) => {
      for (const decor of [null, ...DECOR_KINDS]) {
        const code = lookCode({ pair, decor });
        expect(lookOfCode(code)).toEqual({ pair, decor });
        codes.add(code);
      }
    });
    expect(codes.size).toBe(PLAIN_PAIRS.length * (DECOR_KINDS.length + 1));
    expect(codes.has(GOLDEN_LOOK)).toBe(false);
  });

  it('remembers the run seed: the views see the look the seed decides', () => {
    plainLooks.setRunSeed(9);
    const seed = cosmeticSeedOf(9);
    for (let i = 1; i <= 20; i++)
      expect(plainLooks.codeFor(i)).toBe(lookCode(plainLookAt(seed, i)));
    plainLooks.setRunSeed(10);
    expect(plainLooks.codeFor(3)).toBe(lookCode(plainLookAt(cosmeticSeedOf(10), 3)));
  });

  it('takes the cosmetic stream, not the seed itself', () => {
    expect(cosmeticSeedOf(5)).not.toBe(5);
  });
});

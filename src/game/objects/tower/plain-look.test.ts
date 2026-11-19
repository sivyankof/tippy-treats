import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/common/rng';
import {
  DECOR_KINDS,
  PATTERN_KINDS,
  PLAIN_LAYER,
  PLAIN_PAIRS,
  SPONGES,
} from '../../../data/tower/plain-layers';
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
  it('has 13 pairs of the five sponges, each with its own decorations', () => {
    expect(PLAIN_PAIRS.length).toBe(13);
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

  it('round-trips every pair, decoration and pattern through its code; the golden code is none', () => {
    const codes = new Set<number>();
    PLAIN_PAIRS.forEach((_, pair) => {
      const looks = [
        { pair, decor: null, pattern: null },
        ...DECOR_KINDS.map((decor) => ({ pair, decor, pattern: null })),
        ...PATTERN_KINDS.map((pattern) => ({ pair, decor: null, pattern })),
      ];
      for (const look of looks) {
        const code = lookCode(look);
        expect(lookOfCode(code)).toEqual(look);
        codes.add(code);
      }
    });
    expect(codes.size).toBe(PLAIN_PAIRS.length * (1 + DECOR_KINDS.length + PATTERN_KINDS.length));
    expect(codes.has(GOLDEN_LOOK)).toBe(false);
    expect(Math.max(...codes)).toBeLessThan(GOLDEN_LOOK);
  });

  it('puts a pattern only on layers without decorations, on about two thirds of those', () => {
    const seed = cosmeticSeedOf(42);
    let bare = 0;
    let patterned = 0;
    for (let i = 1; i <= LAYERS * 2; i++) {
      const look = plainLookAt(seed, i);
      if (look.decor) {
        expect(look.pattern).toBeNull();
        continue;
      }
      bare++;
      if (look.pattern) patterned++;
    }
    const share = patterned / bare;
    expect(share).toBeGreaterThan(1 - PLAIN_LAYER.pattern.plainShare - 0.1);
    expect(share).toBeLessThan(1 - PLAIN_LAYER.pattern.plainShare + 0.1);
  });

  it('leaves the decoration decisions to the decor stream alone', () => {
    for (const run of [0, 3, 99]) {
      const seed = cosmeticSeedOf(run);
      for (let i = 1; i <= 200; i++) {
        const rng = new Rng(seed).fork(`decor:${i}`);
        const options = PLAIN_PAIRS[pairAt(seed, i)]!.decor;
        const decorated = rng.next() < PLAIN_LAYER.decorShare && options.length > 0;
        const expected = decorated ? options[rng.int(0, options.length - 1)]! : null;
        expect(plainLookAt(seed, i).decor).toBe(expected);
      }
    }
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

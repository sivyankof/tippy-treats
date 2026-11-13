import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

const take = (rng: Rng, count: number): number[] => Array.from({ length: count }, () => rng.next());

describe('Rng', () => {
  it('repeats the sequence for the same seed', () => {
    expect(take(new Rng(12345), 20)).toEqual(take(new Rng(12345), 20));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(new Rng(1), 5)).not.toEqual(take(new Rng(2), 5));
  });

  it('stays inside [0, 1) and is roughly uniform', () => {
    const values = take(new Rng(20261113), 10000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it('normalises the seed to an unsigned 32-bit integer', () => {
    expect(new Rng(-1).seed).toBe(0xffffffff);
    expect(take(new Rng(-1), 3)).toEqual(take(new Rng(0xffffffff), 3));
  });

  it('range and int respect their bounds', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const f = rng.range(-260, 260);
      expect(f).toBeGreaterThanOrEqual(-260);
      expect(f).toBeLessThan(260);
      seen.add(rng.int(4, 6));
    }
    expect([...seen].sort()).toEqual([4, 5, 6]);
  });

  it('chance follows the probability', () => {
    const rng = new Rng(99);
    let hits = 0;
    for (let i = 0; i < 10000; i++) {
      if (rng.chance(0.35)) hits++;
    }
    expect(hits / 10000).toBeCloseTo(0.35, 1);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  describe('normal', () => {
    const draw = (rng: Rng, count: number): number[] =>
      Array.from({ length: count }, () => rng.normal());

    it('is deterministic for the same seed', () => {
      expect(draw(new Rng(3), 20)).toEqual(draw(new Rng(3), 20));
    });

    it('uses exactly two draws per value', () => {
      const a = new Rng(8);
      const b = new Rng(8);
      a.normal();
      b.next();
      b.next();
      expect(a.next()).toBe(b.next());
    });

    it('has mean near 0 and sd near 1', () => {
      const values = draw(new Rng(20261113), 20000);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      expect(mean).toBeCloseTo(0, 1);
      expect(Math.sqrt(variance)).toBeCloseTo(1, 1);
    });
  });

  describe('fork', () => {
    it('is stable for the same seed and name', () => {
      expect(take(new Rng(5).fork('zones'), 10)).toEqual(take(new Rng(5).fork('zones'), 10));
    });

    it('differs by name and by seed', () => {
      const zones = take(new Rng(5).fork('zones'), 5);
      expect(zones).not.toEqual(take(new Rng(5).fork('coins'), 5));
      expect(zones).not.toEqual(take(new Rng(6).fork('zones'), 5));
    });

    it('does not depend on how much the parent stream was used', () => {
      const fresh = new Rng(5);
      const used = new Rng(5);
      take(used, 100);
      expect(take(used.fork('coins'), 10)).toEqual(take(fresh.fork('coins'), 10));
    });

    it('does not advance the parent stream', () => {
      const plain = new Rng(5);
      const forked = new Rng(5);
      take(forked.fork('zones'), 50);
      expect(take(forked, 10)).toEqual(take(plain, 10));
    });
  });
});

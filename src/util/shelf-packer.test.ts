import { describe, expect, it } from 'vitest';
import { ShelfPacker } from './shelf-packer';

describe('ShelfPacker', () => {
  it('fills a shelf left to right, then opens the next one below', () => {
    const p = new ShelfPacker(100, 100, 10);
    expect(p.alloc(40, 15)).toEqual({ x: 0, y: 0 });
    expect(p.alloc(40, 12)).toEqual({ x: 40, y: 0 });
    expect(p.alloc(40, 12)).toEqual({ x: 0, y: 20 });
    expect(p.usedHeight).toBe(40);
  });

  it('puts a box on the lowest shelf tall enough for it', () => {
    const p = new ShelfPacker(100, 100, 10);
    p.alloc(90, 50);
    p.alloc(90, 10);
    expect(p.alloc(10, 8)).toEqual({ x: 90, y: 50 });
    expect(p.alloc(10, 30)).toEqual({ x: 90, y: 0 });
  });

  it('returns null when nothing fits', () => {
    const p = new ShelfPacker(100, 30, 10);
    expect(p.alloc(101, 5)).toBeNull();
    expect(p.alloc(50, 31)).toBeNull();
    p.alloc(100, 30);
    expect(p.alloc(1, 1)).toBeNull();
  });

  it('reuses freed runs and merges neighbours', () => {
    const p = new ShelfPacker(100, 100, 10);
    const a = p.alloc(30, 10)!;
    const b = p.alloc(30, 10)!;
    p.alloc(30, 10);
    p.free(a, 30);
    p.free(b, 30);
    expect(p.alloc(60, 10)).toEqual({ x: 0, y: 0 });
  });

  it('closes an empty last shelf so a taller box can take its place', () => {
    const p = new ShelfPacker(100, 40, 10);
    p.alloc(100, 20);
    const small = p.alloc(50, 10)!;
    expect(p.usedHeight).toBe(30);
    p.free(small, 50);
    expect(p.usedHeight).toBe(20);
    expect(p.alloc(100, 20)).toEqual({ x: 0, y: 20 });
  });

  it('keeps a steady footprint when boxes come and go', () => {
    const p = new ShelfPacker(1000, 1000, 8);
    const live: Array<{ box: { x: number; y: number }; w: number }> = [];
    let seed = 7;
    const next = (): number => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    let peak = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (live.length >= 20) {
        const [old] = live.splice(Math.floor(next() * live.length), 1);
        if (old) p.free(old.box, old.w);
      }
      const w = 100 + Math.floor(next() * 200);
      const box = p.alloc(w, 50);
      expect(box).not.toBeNull();
      live.push({ box: box!, w });
      if (i > 500) peak = Math.max(peak, p.usedHeight);
    }
    expect(peak).toBeLessThanOrEqual(56 * 10);
  });
});

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

  it('reports a full page, then serves a freed cell again', () => {
    const p = new ShelfPacker(4096, 2048, 8);
    const boxes: Array<{ x: number; y: number }> = [];
    for (let box = p.alloc(1024, 1024); box; box = p.alloc(1024, 1024)) boxes.push(box);
    expect(boxes).toHaveLength(8);
    expect(p.alloc(1024, 1024)).toBeNull();
    const freed = boxes[3]!;
    p.free(freed, 1024);
    expect(p.alloc(1024, 1024)).toEqual(freed);
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

  it('joins neighbouring empty shelves into a taller one', () => {
    const p = new ShelfPacker(100, 100, 10);
    const a = p.alloc(100, 20)!;
    const b = p.alloc(100, 20)!;
    p.alloc(100, 20);
    p.free(a, 100);
    p.free(b, 100);
    expect(p.alloc(100, 40)).toEqual({ x: 0, y: 0 });
    expect(p.usedHeight).toBe(60);
  });

  it('keeps the rest of a joined row as an empty shelf', () => {
    const p = new ShelfPacker(100, 100, 10);
    const a = p.alloc(100, 30)!;
    const b = p.alloc(100, 30)!;
    p.alloc(100, 10);
    p.free(a, 100);
    p.free(b, 100);
    expect(p.alloc(100, 40)).toEqual({ x: 0, y: 0 });
    expect(p.alloc(100, 20)).toEqual({ x: 0, y: 40 });
    expect(p.usedHeight).toBe(70);
  });

  it('a long-lived small box does not wear a tall empty shelf down', () => {
    const p = new ShelfPacker(100, 100, 10);
    const tall = p.alloc(100, 50)!;
    p.alloc(100, 10);
    p.free(tall, 100);
    expect(p.alloc(10, 10)).toEqual({ x: 0, y: 0 });
    // The shelf is still 50 tall: a tall box sits beside the small one, no new shelf opens.
    expect(p.alloc(90, 50)).toEqual({ x: 10, y: 0 });
    expect(p.usedHeight).toBe(60);
  });

  it('skips the search for a row to join when no shelf is empty', () => {
    const p = new ShelfPacker(100, 100, 10);
    p.alloc(100, 30);
    p.alloc(100, 30);
    expect(p.alloc(100, 30)).toEqual({ x: 0, y: 60 });
    expect(p.alloc(100, 30)).toBeNull();
  });

  it('never overlaps boxes and keeps its empty-shelf count honest under random use', () => {
    const p = new ShelfPacker(200, 300, 10);
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const live: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let step = 0; step < 600; step++) {
      if (live.length > 0 && next(3) === 0) {
        const [gone] = live.splice(next(live.length), 1);
        if (gone) p.free(gone, gone.w);
        continue;
      }
      const w = 10 + next(120);
      const h = 10 + next(80);
      const box = p.alloc(w, h);
      if (!box) continue;
      for (const o of live) {
        const apart =
          box.x + w <= o.x || o.x + o.w <= box.x || box.y + h <= o.y || o.y + o.h <= box.y;
        expect(apart).toBe(true);
      }
      live.push({ ...box, w, h });
      expect(p.usedHeight).toBeLessThanOrEqual(300);
    }
    const inner = p as unknown as {
      shelves: Array<{ free: Array<{ x0: number; x1: number }> }>;
      emptyCount: number;
    };
    const empty = inner.shelves.filter(
      (sh) => sh.free.length === 1 && sh.free[0]?.x0 === 0 && sh.free[0].x1 === 200,
    );
    expect(inner.emptyCount).toBe(empty.length);
  });
});

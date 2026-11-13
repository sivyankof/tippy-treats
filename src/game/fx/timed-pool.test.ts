import { describe, expect, it } from 'vitest';
import { TimedPool, type PoolEntry } from './timed-pool';

interface Item {
  id: number;
  hidden: boolean;
}

function makePool(maxLive?: number): {
  pool: TimedPool<Item, PoolEntry<Item>>;
  made: Item[];
} {
  const made: Item[] = [];
  const pool = new TimedPool<Item, PoolEntry<Item>>(
    () => {
      const item = { id: made.length, hidden: false };
      made.push(item);
      return item;
    },
    (item) => {
      item.hidden = true;
    },
    maxLive,
  );
  return { pool, made };
}

function start(pool: TimedPool<Item, PoolEntry<Item>>, lifeMs: number): Item {
  const item = pool.take();
  item.hidden = false;
  pool.add({ item, ageMs: 0, lifeMs });
  return item;
}

describe('TimedPool', () => {
  it('ages entries and reports progress', () => {
    const { pool } = makePool();
    start(pool, 100);
    const seen: number[] = [];
    pool.update(25, (_, progress) => seen.push(progress));
    pool.update(50, (_, progress) => seen.push(progress));
    expect(seen).toEqual([0.25, 0.75]);
  });

  it('retires expired entries and reuses their items', () => {
    const { pool, made } = makePool();
    const first = start(pool, 100);
    pool.update(100, () => undefined);
    expect(first.hidden).toBe(true);
    expect(pool.liveCount).toBe(0);
    const second = start(pool, 100);
    expect(second).toBe(first);
    expect(made).toHaveLength(1);
  });

  it('does not step an entry in the frame it expires', () => {
    const { pool } = makePool();
    start(pool, 100);
    let steps = 0;
    pool.update(150, () => (steps += 1));
    expect(steps).toBe(0);
  });

  it('keeps live entries apart and expires them independently', () => {
    const { pool, made } = makePool();
    const short = start(pool, 50);
    const long = start(pool, 200);
    expect(made).toHaveLength(2);
    pool.update(60, () => undefined);
    expect(short.hidden).toBe(true);
    expect(long.hidden).toBe(false);
    expect(pool.liveCount).toBe(1);
  });

  it('retires the oldest entry at the cap and recycles its item', () => {
    const { pool, made } = makePool(2);
    const a = start(pool, 1000);
    start(pool, 1000);
    const c = start(pool, 1000);
    expect(c).toBe(a);
    expect(made).toHaveLength(2);
    expect(pool.liveCount).toBe(2);
  });
});

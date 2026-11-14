import { describe, expect, it } from 'vitest';
import { xpToNext } from './progression';
import { nearMiss, type NearMissInput } from './near-miss';

const input = (over: Partial<NearMissInput> = {}): NearMissInput => ({
  height: 20,
  previousRecord: 40,
  bakerLevel: 1,
  bakerXp: 0,
  coins: 0,
  owned: { honey: { level: 1 } },
  todayBest: 0,
  ...over,
});

describe('near miss line', () => {
  it('names the record when it is at most 10 layers away', () => {
    expect(nearMiss(input({ height: 36 }))).toEqual({ kind: 'record', layers: 4 });
    expect(nearMiss(input({ height: 30 }))).toEqual({ kind: 'record', layers: 10 });
  });

  it('skips the record on the first run and when it was beaten', () => {
    expect(nearMiss(input({ previousRecord: null })).kind).not.toBe('record');
    expect(nearMiss(input({ height: 45 })).kind).not.toBe('record');
  });

  it('then names the next baker level when little XP is left', () => {
    const xp = xpToNext(1) - 12;
    expect(nearMiss(input({ bakerXp: xp }))).toEqual({ kind: 'xp', xp: 12, level: 2 });
  });

  it('then names the closest creature for coins', () => {
    expect(nearMiss(input({ coins: 250 }))).toEqual({
      kind: 'coins',
      coins: 50,
      creature: 'jelly',
    });
    // Creatures already owned or not sold yet do not count.
    const owned = { honey: { level: 1 }, jelly: { level: 1 }, caramel: { level: 1 } };
    expect(nearMiss(input({ coins: 850, owned })).kind).toBe('best');
  });

  it('falls back to the personal record', () => {
    expect(nearMiss(input())).toEqual({ kind: 'best', record: 40, today: 20 });
    expect(nearMiss(input({ todayBest: 31 }))).toEqual({ kind: 'best', record: 40, today: 31 });
    expect(nearMiss(input({ previousRecord: null, height: 9 }))).toEqual({
      kind: 'best',
      record: 9,
      today: 9,
    });
  });
});

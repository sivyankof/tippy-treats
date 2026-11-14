import { describe, expect, it } from 'vitest';
import type { MissionProgress } from './save/schema';
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

const mission = (progress: number, claimed = false): MissionProgress => ({
  id: 'score_3000',
  group: 'medium',
  target: 100,
  progress,
  claimed,
});

describe('near miss line', () => {
  it('names a mission within 30% of its target after the record and before the XP', () => {
    const xp = xpToNext(1) - 12;
    expect(nearMiss(input({ height: 20, missions: [mission(80)] }))).toEqual({
      kind: 'mission',
      id: 'score_3000',
      target: 100,
      remaining: 20,
    });
    expect(nearMiss(input({ height: 36, missions: [mission(80)] })).kind).toBe('record');
    expect(nearMiss(input({ bakerXp: xp, missions: [mission(80)] })).kind).toBe('mission');
  });

  it('ignores missions that are far, done or claimed', () => {
    expect(nearMiss(input({ missions: [mission(50)] })).kind).not.toBe('mission');
    expect(nearMiss(input({ missions: [mission(100)] })).kind).not.toBe('mission');
    expect(nearMiss(input({ missions: [mission(90, true)] })).kind).not.toBe('mission');
  });

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

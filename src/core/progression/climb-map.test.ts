import { describe, expect, it } from 'vitest';
import { climbMap, type ClimbMapInput } from './climb-map';

const base: ClimbMapInput = { record: null, todayBest: 0, checkpoints: [], bestLap: 0 };

describe('climbMap bands', () => {
  it('lists the five Classic zones and lap 1 for a newcomer; only the kitchen is open', () => {
    const { bands } = climbMap(base);
    expect(bands.map((b) => [b.kind, b.zone, b.lap, b.from, b.to, b.open])).toEqual([
      ['zone', 'kitchen', 0, 1, 20, true],
      ['zone', 'showcase', 0, 21, 40, false],
      ['zone', 'roof', 0, 41, 60, false],
      ['zone', 'clouds', 0, 61, 80, false],
      ['zone', 'stars', 0, 81, 100, false],
      ['lap', 'space', 1, 101, 120, false],
    ]);
  });

  it('opens a band once the record reaches its first layer', () => {
    const open = (record: number): boolean[] =>
      climbMap({ ...base, record }).bands.map((b) => b.open);
    expect(open(20)).toEqual([true, false, false, false, false, false]);
    expect(open(21)).toEqual([true, true, false, false, false, false]);
    expect(open(47)).toEqual([true, true, true, false, false, false]);
  });

  it('shows one lap above the highest reached', () => {
    const laps = (input: Partial<ClimbMapInput>): number[] =>
      climbMap({ ...base, ...input })
        .bands.filter((b) => b.kind === 'lap')
        .map((b) => b.lap);
    expect(laps({ record: 100 })).toEqual([1]);
    expect(laps({ record: 101 })).toEqual([1, 2]);
    expect(laps({ record: 167 })).toEqual([1, 2, 3, 4, 5]);
    // A best lap above the one of the record counts too.
    expect(laps({ record: 50, bestLap: 3 })).toEqual([1, 2, 3, 4]);
  });
});

describe('climbMap marks', () => {
  it('has none for a newcomer', () => {
    expect(climbMap(base).marks).toEqual([]);
    expect(climbMap({ ...base, record: 0 }).marks).toEqual([]);
  });

  it('marks the record, a lower today and the opened checkpoints bottom-up', () => {
    const { marks } = climbMap({ record: 47, todayBest: 31, checkpoints: [20, 40], bestLap: 0 });
    expect(marks.map((m) => [m.kind, m.height, m.band, m.value])).toEqual([
      ['checkpoint', 20, 0, 20],
      ['today', 31, 1, 31],
      ['checkpoint', 40, 1, 40],
      ['record', 47, 2, 47],
    ]);
  });

  it('leaves today out when it is zero or not below the record', () => {
    const kinds = (todayBest: number): string[] =>
      climbMap({ ...base, record: 47, todayBest }).marks.map((m) => m.kind);
    expect(kinds(0)).toEqual(['record']);
    expect(kinds(47)).toEqual(['record']);
    expect(kinds(12)).toEqual(['today', 'record']);
  });

  it('marks the best lap from lap 2 on the first layer of its band', () => {
    const { marks } = climbMap({
      record: 167,
      todayBest: 0,
      checkpoints: [20, 40, 60, 80, 100],
      bestLap: 4,
    });
    expect(marks.find((m) => m.kind === 'bestLap')).toEqual({
      kind: 'bestLap',
      height: 161,
      band: 8,
      value: 4,
    });
    expect(marks.find((m) => m.kind === 'record')?.band).toBe(8);
    expect(
      climbMap({ ...base, record: 110, bestLap: 1 }).marks.some((m) => m.kind === 'bestLap'),
    ).toBe(false);
  });

  it('takes the lap of the record when the best lap is behind it', () => {
    const { marks } = climbMap({ ...base, record: 125, bestLap: 0 });
    expect(marks.find((m) => m.kind === 'bestLap')?.value).toBe(2);
  });
});

describe('climbMap goal and anchor', () => {
  it('aims a newcomer at the showcase', () => {
    const map = climbMap(base);
    expect(map.goal).toEqual({ band: 1, layers: 21 });
    expect(map.anchor).toBe(0);
    expect(map.totalLayers).toBe(120);
  });

  it('counts the layers to the first layer of the next shut band', () => {
    expect(climbMap({ ...base, record: 47 }).goal).toEqual({ band: 3, layers: 14 });
    expect(climbMap({ ...base, record: 133 }).goal).toEqual({ band: 7, layers: 8 });
  });

  it('anchors on the record', () => {
    expect(climbMap({ ...base, record: 47 }).anchor).toBe(47);
  });
});

import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import { goalsFromSave } from './run-goals';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const classic = { mode: 'classic', tutorial: false, startHeight: 0 } as const;

function save(patch: { runs?: number; record?: number; dailyDay?: string; dailyBest?: number }) {
  const s = createDefaultSave(NOW, 'test');
  return {
    ...s,
    stats: { ...s.stats, runs: patch.runs ?? 5 },
    records: { ...s.records, classicHeight: patch.record ?? 87 },
    today: { day: '2026-11-26', bestHeight: 34 },
    prevDay: { day: '', bestHeight: 0 },
    daily: { ...s.daily, day: patch.dailyDay ?? '2026-11-27', best: patch.dailyBest ?? 41 },
  };
}

describe('goalsFromSave', () => {
  it('Classic: the best of the last play day, then the record', () => {
    expect(goalsFromSave(save({}), NOW, classic).map((g) => g.height)).toEqual([34, 87]);
  });

  it('has none in the first runs', () => {
    expect(goalsFromSave(save({ runs: 1 }), NOW, classic)).toEqual([]);
  });

  it('daily: the best attempt of today UTC day', () => {
    const goals = goalsFromSave(save({}), NOW, { ...classic, mode: 'daily' });
    expect(goals).toEqual([{ kind: 'dailyBest', height: 41 }]);
  });

  it('daily: yesterday attempt of the save is not a goal today', () => {
    const goals = goalsFromSave(save({ dailyDay: '2026-11-26' }), NOW, {
      ...classic,
      mode: 'daily',
    });
    expect(goals).toEqual([]);
  });
});

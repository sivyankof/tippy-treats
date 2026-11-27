import { describe, expect, it } from 'vitest';
import { goalAbove, resultGoal, runGoals, type RunGoalInput } from './result-goal';

const base: RunGoalInput = {
  mode: 'classic',
  tutorial: false,
  runs: 5,
  startHeight: 0,
  prevBest: { day: '2026-11-26', bestHeight: 34 },
  localToday: '2026-11-27',
  record: 87,
  dailyBest: 41,
};

describe('runGoals', () => {
  it('Classic: yesterday, then the record', () => {
    expect(runGoals(base)).toEqual([
      { kind: 'yesterday', height: 34 },
      { kind: 'record', height: 87 },
    ]);
  });

  it('calls an older best "last time"', () => {
    const goals = runGoals({ ...base, prevBest: { day: '2026-11-20', bestHeight: 34 } });
    expect(goals[0]).toEqual({ kind: 'lastTime', height: 34 });
  });

  it('calls a best of an unknown day "last time"', () => {
    const goals = runGoals({ ...base, prevBest: { day: '', bestHeight: 12 } });
    expect(goals[0]?.kind).toBe('lastTime');
  });

  it('drops a previous best that reaches the record', () => {
    expect(runGoals({ ...base, prevBest: { day: '2026-11-26', bestHeight: 87 } })).toEqual([
      { kind: 'record', height: 87 },
    ]);
    expect(runGoals({ ...base, prevBest: { day: '2026-11-26', bestHeight: 90 } })).toEqual([
      { kind: 'record', height: 87 },
    ]);
  });

  it('has no previous best for a new player of the day', () => {
    expect(runGoals({ ...base, prevBest: { day: '', bestHeight: 0 } })).toEqual([
      { kind: 'record', height: 87 },
    ]);
  });

  it('daily: only the best attempt of the day', () => {
    expect(runGoals({ ...base, mode: 'daily' })).toEqual([{ kind: 'dailyBest', height: 41 }]);
    expect(runGoals({ ...base, mode: 'daily', dailyBest: 0 })).toEqual([]);
  });

  it('has none in the tutorial and in the first two runs', () => {
    expect(runGoals({ ...base, tutorial: true })).toEqual([]);
    expect(runGoals({ ...base, runs: 0 })).toEqual([]);
    expect(runGoals({ ...base, runs: 1 })).toEqual([]);
    expect(runGoals({ ...base, runs: 2 })).toHaveLength(2);
  });

  it('keeps only goals above the start height', () => {
    expect(runGoals({ ...base, startHeight: 34 })).toEqual([{ kind: 'record', height: 87 }]);
    expect(runGoals({ ...base, startHeight: 87 })).toEqual([]);
  });

  it('keeps no zero goal', () => {
    expect(runGoals({ ...base, record: 0, prevBest: { day: '', bestHeight: 0 } })).toEqual([]);
  });
});

describe('goalAbove', () => {
  const goals = runGoals(base);

  it('picks the first goal above the height', () => {
    expect(goalAbove(goals, 0)?.kind).toBe('yesterday');
    expect(goalAbove(goals, 33)?.kind).toBe('yesterday');
    expect(goalAbove(goals, 34)?.kind).toBe('record');
    expect(goalAbove(goals, 86)?.kind).toBe('record');
  });

  it('is null after the last goal and without goals', () => {
    expect(goalAbove(goals, 87)).toBeNull();
    expect(goalAbove([], 3)).toBeNull();
  });
});

describe('resultGoal', () => {
  it('joins both', () => {
    expect(resultGoal({ ...base, height: 40 })).toEqual({ kind: 'record', height: 87 });
    expect(resultGoal({ ...base, height: 100 })).toBeNull();
    expect(resultGoal({ ...base, tutorial: true, height: 0 })).toBeNull();
  });
});

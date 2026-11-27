import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run/run-result';
import { createTestState } from './test-state';

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 12,
    score: 100,
    coins: 3,
    berries: 0,
    perfects: 2,
    bestCombo: 3,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 1000,
    endReason: 'miss',
    ...over,
  };
}

describe('GameState.onRunRecorded', () => {
  it('hands every listener the save after the run, until unsubscribed', () => {
    const state = createTestState();
    const seen: number[] = [];
    const off = state.onRunRecorded((save) => seen.push(save.records.classicHeight));
    state.recordRun(run({ height: 12 }));
    off();
    state.recordRun(run({ height: 30 }));
    expect(seen).toEqual([12]);
  });

  it('keeps the run when a listener throws', () => {
    const state = createTestState();
    const seen: number[] = [];
    state.onRunRecorded(() => {
      throw new Error('boom');
    });
    state.onRunRecorded((save) => seen.push(save.stats.runs));
    expect(() => state.recordRun(run())).not.toThrow();
    expect(state.data.stats.runs).toBe(1);
    expect(seen).toEqual([1]);
  });
});

import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run/run-result';
import { createDefaultSave } from '../core/save/defaults';
import { LAP_REWARD } from '../data/zones/zones';
import { loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 10,
    score: 100,
    coins: 0,
    berries: 0,
    perfects: 0,
    bestCombo: 0,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 1000,
    endReason: 'miss',
    ...over,
  };
}

async function player(over: Record<string, unknown> = {}) {
  const base = createDefaultSave(T0, 'test');
  return loadTestState(
    {
      ...base,
      stats: { ...base.stats, runs: 3 },
      tutorial: { firstRunDone: true, hintsShown: ['tutorial', 'firstResults'] },
      ...over,
    },
    { ms: T0 },
  );
}

describe('first-time lap berries', () => {
  const { berries } = LAP_REWARD;

  it('pays once per new lap and remembers the best lap', async () => {
    const state = await player();
    const first = state.recordRun(run({ height: 121 }));
    expect(first.lapBerries).toBe(berries);
    expect(state.berries).toBe(berries);
    expect(state.data.bestLap).toBe(2);
    const again = state.recordRun(run({ height: 135 }));
    expect(again.lapBerries).toBe(0);
    expect(state.berries).toBe(berries);
  });

  it('pays for each lap a run jumps over', async () => {
    const state = await player();
    expect(state.recordRun(run({ height: 165 })).lapBerries).toBe(3 * berries);
  });

  it('pays nothing for the first lap, the daily tower or laps past the last rewarded one', async () => {
    const state = await player();
    expect(state.recordRun(run({ height: 120 })).lapBerries).toBe(0);
    expect(state.recordRun(run({ mode: 'daily', height: 300 })).lapBerries).toBe(0);
    expect(state.data.bestLap).toBe(1);
    expect(state.recordRun(run({ height: 5000 })).lapBerries).toBe(9 * berries);
    expect(state.recordRun(run({ height: 6000 })).lapBerries).toBe(0);
  });

  it('counts a run from a checkpoint too and pays nothing retroactively', async () => {
    const state = await player({
      records: { classicHeight: 130, classicScore: 0, bestCombo: 0 },
      bestLap: 2,
    });
    expect(state.recordRun(run({ height: 125 }), 100).lapBerries).toBe(0);
    expect(state.recordRun(run({ height: 145 }), 100).lapBerries).toBe(berries);
  });
});

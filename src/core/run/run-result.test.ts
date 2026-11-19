import { describe, expect, it } from 'vitest';
import { isEmptyRun, type RunResult } from './run-result';

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 0,
    score: 0,
    coins: 0,
    berries: 0,
    perfects: 0,
    bestCombo: 0,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 0,
    endReason: 'quit',
    ...over,
  };
}

describe('isEmptyRun', () => {
  it('is true when nothing was earned', () => {
    expect(isEmptyRun(run())).toBe(true);
    expect(isEmptyRun(run({ height: 5 }), 5)).toBe(true);
  });

  it('is false once a layer, score, coins or berries came in', () => {
    expect(isEmptyRun(run({ height: 6 }), 5)).toBe(false);
    expect(isEmptyRun(run({ score: 10 }))).toBe(false);
    expect(isEmptyRun(run({ coins: 1 }))).toBe(false);
    expect(isEmptyRun(run({ berries: 1 }))).toBe(false);
  });
});

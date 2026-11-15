import { describe, expect, it, vi } from 'vitest';
import { CLASSIC_RUN, DAILY_RUN, checkpointRun, demoRun } from './run-request';
import { decideRestart, restartRequest } from './run-restart';

describe('decideRestart', () => {
  it('spends an attempt for a daily run and starts it', () => {
    const spend = vi.fn(() => true);
    expect(decideRestart(DAILY_RUN, spend)).toBe('run');
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it('opens the daily screen when no attempt is left', () => {
    expect(decideRestart(DAILY_RUN, () => false)).toBe('daily-screen');
  });

  it('never spends an attempt for classic and demo runs', () => {
    const spend = vi.fn(() => false);
    expect(decideRestart(CLASSIC_RUN, spend)).toBe('run');
    expect(decideRestart(demoRun('ghost', 1, 'team'), spend)).toBe('run');
    expect(spend).not.toHaveBeenCalled();
  });
});

describe('restartRequest', () => {
  it('restarts a run from a checkpoint from zero, for free', () => {
    expect(restartRequest(checkpointRun(40))).toEqual(CLASSIC_RUN);
    // The ad that paid for the start is dropped with the checkpoint.
    expect(restartRequest(checkpointRun(40, true))).toEqual(CLASSIC_RUN);
  });

  it('keeps every other request', () => {
    expect(restartRequest(CLASSIC_RUN)).toBe(CLASSIC_RUN);
    expect(restartRequest(DAILY_RUN)).toBe(DAILY_RUN);
    const demo = demoRun('ghost', 1, 'team');
    expect(restartRequest(demo)).toBe(demo);
  });
});

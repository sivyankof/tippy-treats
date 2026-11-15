import { describe, expect, it, vi } from 'vitest';
import { CLASSIC_RUN, DAILY_RUN, demoRun } from './run-request';
import { decideRestart } from './run-restart';

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

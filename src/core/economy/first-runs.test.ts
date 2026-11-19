import { describe, expect, it } from 'vitest';
import { FIRST_RUNS } from '../../data/economy/first-runs';
import { isCleanRun, pastQuietRuns } from './first-runs';

describe('first runs', () => {
  it('keeps the first 3 runs clean', () => {
    expect(FIRST_RUNS.clean).toBe(3);
    expect(isCleanRun(0)).toBe(true);
    // The 3rd run comes after 2 finished ones, the 4th after 3.
    expect(isCleanRun(2)).toBe(true);
    expect(isCleanRun(3)).toBe(false);
    expect(isCleanRun(4)).toBe(false);
  });

  it('opens sales from the 10th finished run', () => {
    expect(FIRST_RUNS.quiet).toBe(10);
    expect(pastQuietRuns(0)).toBe(false);
    expect(pastQuietRuns(9)).toBe(false);
    expect(pastQuietRuns(10)).toBe(true);
    expect(pastQuietRuns(11)).toBe(true);
  });
});

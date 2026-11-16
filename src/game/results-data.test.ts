import { describe, expect, it } from 'vitest';
import { isDebugRun, isLiveRun } from './results-data';

describe('isDebugRun', () => {
  it('marks a run that is not saved, in the dev build only', () => {
    expect(isDebugRun(false, true)).toBe(true);
    expect(isDebugRun(false, false)).toBe(false);
    expect(isDebugRun(true, true)).toBe(false);
    expect(isDebugRun(true, false)).toBe(false);
  });
});

describe('isLiveRun', () => {
  it('is true only for a run that reached the save and is not a benchmark run', () => {
    expect(isLiveRun({ recorded: true })).toBe(true);
    expect(isLiveRun({ recorded: true, benchmark: false })).toBe(true);
    expect(isLiveRun({ recorded: true, benchmark: true })).toBe(false);
    expect(isLiveRun({ recorded: false })).toBe(false);
  });
});

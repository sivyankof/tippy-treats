import { describe, expect, it } from 'vitest';
import { isDebugRun } from './results-data';

describe('isDebugRun', () => {
  it('marks a run that is not saved, in the dev build only', () => {
    expect(isDebugRun(false, true)).toBe(true);
    expect(isDebugRun(false, false)).toBe(false);
    expect(isDebugRun(true, true)).toBe(false);
    expect(isDebugRun(true, false)).toBe(false);
  });
});

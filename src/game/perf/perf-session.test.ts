import { afterEach, describe, expect, it } from 'vitest';
import { PERF } from '../../data/perf';
import { CLASSIC_RUN } from '../run-request';
import type { ResultsData } from '../scene-keys';
import { isLiveRun } from '../results-data';
import {
  beginPerfSession,
  endPerfSession,
  perfResultsData,
  perfRunSetup,
  perfSession,
} from './perf-session';

describe('perf session', () => {
  afterEach(() => endPerfSession());

  it('replaces the runs while it is on and lets later runs be normal once it ends', () => {
    beginPerfSession({ fx: 'full', only: null, still: null });
    expect(perfSession()).not.toBeNull();
    expect(perfRunSetup(CLASSIC_RUN)).not.toBeNull();
    endPerfSession();
    expect(perfSession()).toBeNull();
    expect(perfRunSetup(CLASSIC_RUN)).toBeNull();
  });

  it('shows the results of a benchmark run as saved, but not as a live run', () => {
    const data = {
      recorded: false,
      summary: { xpGained: 0, oven: null },
    } as unknown as ResultsData;
    const shown = perfResultsData(data);
    expect(shown.recorded).toBe(true);
    expect(shown.summary.xpGained).toBe(PERF.results.xpGained);
    expect(isLiveRun(shown)).toBe(false);
  });
});

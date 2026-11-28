import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../core/run/run-result';
import { emptyTally } from '../../core/run/run-tally';
import { bindRunDraft, extrasOf, RunRecorder } from './run-recorder';
import { EMPTY_SUMMARY } from '../../state/game-state';

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 4,
    score: 40,
    coins: 12,
    berries: 1,
    perfects: 1,
    bestCombo: 1,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 900,
    endReason: 'quit',
    ...over,
  };
}

function setup(result: RunResult | null) {
  const summary = { ...EMPTY_SUMMARY, xpGained: 4 };
  const sink = {
    recordRun: vi.fn(() => summary),
    keepRunDraft: vi.fn(() => Promise.resolve()),
    dropRunDraft: vi.fn(() => Promise.resolve()),
  };
  return { sink, summary, sim: { quitResult: () => result } };
}

describe('RunRecorder drafts', () => {
  it('keeps the run as a quit in the background and drops it when the app is back', () => {
    const { sink, sim } = setup(run());
    const recorder = new RunRecorder(sink, 0, true, () => ({
      ...extrasOf(emptyTally()),
      flies: 2,
    }));
    recorder.keepDraft(sim);
    expect(sink.keepRunDraft).toHaveBeenCalledWith(run(), 0, expect.objectContaining({ flies: 2 }));
    recorder.dropDraft();
    recorder.dropDraft();
    expect(sink.dropRunDraft).toHaveBeenCalledTimes(1);
    expect(sink.recordRun).not.toHaveBeenCalled();
  });

  it('keeps no draft for a disabled, recorded or empty run', () => {
    const off = setup(run());
    new RunRecorder(off.sink, 0, false).keepDraft(off.sim);
    expect(off.sink.keepRunDraft).not.toHaveBeenCalled();

    const done = setup(run());
    const recorded = new RunRecorder(done.sink, 0);
    recorded.recordOver(run({ endReason: 'miss' }));
    recorded.keepDraft(done.sim);
    expect(done.sink.keepRunDraft).not.toHaveBeenCalled();

    const empty = setup(run({ height: 0, score: 0, coins: 0, berries: 0 }));
    new RunRecorder(empty.sink, 0).keepDraft(empty.sim);
    expect(empty.sink.keepRunDraft).not.toHaveBeenCalled();
  });

  it('follows the background and the return of the app until unbound', () => {
    const { sink, sim } = setup(run());
    const recorder = new RunRecorder(sink, 0);
    const handlers = new Map<string, () => void>();
    const events = {
      on: (name: string, fn: () => void) => handlers.set(name, fn),
      off: (name: string) => handlers.delete(name),
    };
    const unbind = bindRunDraft(
      events,
      { hidden: 'h', visible: 'v' },
      () => recorder,
      () => sim,
    );
    handlers.get('h')?.();
    handlers.get('v')?.();
    expect(sink.keepRunDraft).toHaveBeenCalledTimes(1);
    expect(sink.dropRunDraft).toHaveBeenCalledTimes(1);
    unbind();
    expect(handlers.size).toBe(0);
  });
});

describe('RunRecorder', () => {
  it('writes nothing when it is disabled', () => {
    const { sink, sim } = setup(run());
    const recorder = new RunRecorder(sink, 0, false);
    recorder.recordOver(run({ endReason: 'miss' }));
    recorder.recordQuit(sim);
    expect(sink.recordRun).not.toHaveBeenCalled();
    expect(recorder.summary).toBeNull();
  });

  it('records a quit run once, with the quit result', () => {
    const { sink, sim, summary } = setup(run());
    const recorder = new RunRecorder(sink, 0);
    recorder.recordQuit(sim);
    recorder.recordQuit(sim);
    expect(sink.recordRun).toHaveBeenCalledTimes(1);
    expect(sink.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({ endReason: 'quit' }),
      0,
      undefined,
    );
    expect(recorder.summary).toBe(summary);
  });

  it('passes the counters of the tally along with the result', () => {
    const { sink } = setup(run());
    const tally = emptyTally();
    tally.coins.floating = 7;
    tally.abilities = 2;
    tally.maxWobble = 31;
    tally.flies = 3;
    const recorder = new RunRecorder(sink, 0, true, () => extrasOf(tally));
    recorder.recordOver(run({ endReason: 'miss' }));
    expect(sink.recordRun).toHaveBeenCalledWith(expect.anything(), 0, {
      floatingCoins: 7,
      abilities: 2,
      maxWobble: 31,
      flies: 3,
      coinSources: expect.objectContaining({ floating: 7 }),
    });
  });

  it('does not record a quit after the run ended and was recorded', () => {
    const { sink, sim } = setup(run());
    const recorder = new RunRecorder(sink, 0);
    recorder.recordOver(run({ endReason: 'miss' }));
    recorder.recordQuit(sim);
    recorder.recordOver(run());
    expect(sink.recordRun).toHaveBeenCalledTimes(1);
  });

  it('does not record a quit of a run that is over (no quit result)', () => {
    const { sink, sim } = setup(null);
    const recorder = new RunRecorder(sink, 0);
    recorder.recordQuit(sim);
    expect(sink.recordRun).not.toHaveBeenCalled();
    expect(recorder.summary).toBeNull();
  });

  it('does not count a quit that earned nothing', () => {
    const { sink, sim } = setup(run({ height: 3, score: 0, coins: 0, berries: 0 }));
    const recorder = new RunRecorder(sink, 3);
    recorder.recordQuit(sim);
    expect(sink.recordRun).not.toHaveBeenCalled();
  });
});

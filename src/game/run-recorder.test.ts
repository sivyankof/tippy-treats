import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../core/run-result';
import { emptyTally } from '../core/run-tally';
import { extrasOf, RunRecorder } from './run-recorder';
import { EMPTY_SUMMARY } from '../state/game-state';

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
  const sink = { recordRun: vi.fn(() => summary) };
  return { sink, summary, sim: { quitResult: () => result } };
}

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
    const recorder = new RunRecorder(sink, 0, true, () => extrasOf(tally));
    recorder.recordOver(run({ endReason: 'miss' }));
    expect(sink.recordRun).toHaveBeenCalledWith(expect.anything(), 0, {
      floatingCoins: 7,
      abilities: 2,
      maxWobble: 31,
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

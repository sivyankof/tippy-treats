import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { FrameWorkWatch } from './frame-work-watch';

const A = ANIM.fx.auto;
const OPTIONS = {
  budgetMs: A.budgetMs,
  onShare: A.onShare,
  onWindowMs: A.onWindowMs,
  offWindowMs: A.offWindowMs,
  offMarginMs: A.offMarginMs,
  offBadShare: A.offBadShare,
  lateIntervalMs: A.lateIntervalMs,
  quickIntervalMs: A.quickIntervalMs,
  gpuOnShare: A.gpuOnShare,
  gpuQuickShare: A.gpuQuickShare,
  gpuOffShare: A.gpuOffShare,
  gpuUpHoldMs: A.gpuUpHoldMs,
  minSwitchGapMs: A.minSwitchGapMs,
  resumeIgnoreMs: A.resumeIgnoreMs,
  gapMs: A.gapMs,
  bucketMs: A.bucketMs,
};
const SLOW_WORK = A.budgetMs + 8;
const FAST_WORK = 5;
const SLOW_FRAME_MS = 25;
const FRAME_60 = 1000 / 60;

/** A scene was created at time 0: the watch counts frames from the end of the warm-up. */
function newWatch(): { watch: FrameWorkWatch; start: number } {
  const watch = new FrameWorkWatch(OPTIONS);
  watch.restart(0, A.warmUpMs);
  return { watch, start: A.warmUpMs };
}

/** Feeds frames of `frameMs` carrying `workMs` of work from `from` for `ms`; returns the end time. */
function run(
  watch: FrameWorkWatch,
  from: number,
  ms: number,
  frameMs: number,
  workMs: number | ((i: number) => number),
): number {
  let t = from;
  let i = 0;
  while (t < from + ms) {
    t += frameMs;
    watch.note(typeof workMs === 'function' ? workMs(i++) : workMs, t);
  }
  return t;
}

describe('FrameWorkWatch', () => {
  it('turns on when nearly every frame is over budget for the window', () => {
    const { watch, start } = newWatch();
    run(watch, start, A.onWindowMs - 1000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(0);
    run(watch, start + A.onWindowMs - 1000, 2000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(1);
  });

  it('does not turn on for a throttled 30 fps phone with short frame work', () => {
    const { watch, start } = newWatch();
    run(watch, start, 60_000, 1000 / 30, FAST_WORK);
    expect(watch.level).toBe(0);
  });

  it('does not turn on for a 120 Hz screen with short frame work', () => {
    const { watch, start } = newWatch();
    run(watch, start, 30_000, 1000 / 120, FAST_WORK);
    expect(watch.level).toBe(0);
  });

  it('does not turn on when only some frames are over budget', () => {
    const { watch, start } = newWatch();
    run(watch, start, 20_000, FRAME_60, (i) => (i % 5 === 0 ? SLOW_WORK : FAST_WORK));
    expect(watch.level).toBe(0);
  });

  it('ignores slow frames during the warm-up', () => {
    const watch = new FrameWorkWatch(OPTIONS);
    watch.restart(0, A.warmUpMs);
    const end = run(watch, 0, A.warmUpMs - 100, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(0);
    // The slow frames of the warm-up do not count: the window still needs its full length.
    run(watch, end + 100, A.onWindowMs - 1000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(0);
  });

  it('ignores the frames after a return from the background', () => {
    const { watch, start } = newWatch();
    let t = run(watch, start, 2000, FRAME_60, FAST_WORK);
    t += 60_000;
    // The first frames back are slow (everything wakes up), then the device is fine.
    t = run(watch, t, A.resumeIgnoreMs - 50, SLOW_FRAME_MS, SLOW_WORK);
    run(watch, t, 10_000, FRAME_60, FAST_WORK);
    expect(watch.level).toBe(0);
  });

  it('does not join slow stretches cut by a background gap into one window', () => {
    const { watch, start } = newWatch();
    let t = run(watch, start, 3000, SLOW_FRAME_MS, SLOW_WORK);
    t += 5000;
    t = run(watch, t, 3000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(0);
    run(watch, t, 3000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(1);
  });

  it('goes back to full effects after 10 s of frames inside the budget with a margin', () => {
    const { watch, start } = newWatch();
    let t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(1);
    // Frames inside the budget but not with the margin: it stays on.
    t = run(watch, t, 40_000, FRAME_60, A.budgetMs - 1);
    expect(watch.level).toBe(1);
    run(watch, t, A.offWindowMs + A.minSwitchGapMs, FRAME_60, FAST_WORK);
    expect(watch.level).toBe(0);
  });

  it('does not go back before the 30 s between switches have passed', () => {
    const { watch, start } = newWatch();
    const t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(1);
    // 12 s of good frames: the recovery window is full, the switch gap is not over.
    const mid = run(watch, t, 12_000, FRAME_60, FAST_WORK);
    expect(watch.level).toBe(1);
    run(watch, mid, A.minSwitchGapMs, FRAME_60, FAST_WORK);
    expect(watch.level).toBe(0);
  });

  it('does not switch again within 30 s when the device turns slow right after', () => {
    const { watch, start } = newWatch();
    let t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
    // Good frames until the mode goes off.
    while (watch.level > 0) t = run(watch, t, 1000, FRAME_60, FAST_WORK);
    const offAt = t;
    // Slow again, but the 30 s since the last switch are not over: it stays off.
    while (t - offAt < A.minSwitchGapMs - 3000) t = run(watch, t, 1000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(0);
    run(watch, t, 10_000, SLOW_FRAME_MS, SLOW_WORK);
    expect(watch.level).toBe(1);
  });

  describe('GPU signal (frame interval with low work)', () => {
    /** 60 Hz pattern: every third frame is doubled to 33.3 ms (a third of the frames are late). */
    const gpuBound = (i: number): number => (i % 3 === 0 ? 2 * FRAME_60 : FRAME_60);
    const GPU_WORK = 6;

    /** Feeds frames whose interval comes from `frameMs(i)`; returns the end time. */
    function runIntervals(
      watch: FrameWorkWatch,
      from: number,
      ms: number,
      frameMs: (i: number) => number,
      workMs: number,
    ): number {
      let t = from;
      for (let i = 0; t < from + ms; i++) {
        t += frameMs(i);
        watch.note(workMs, t);
      }
      return t;
    }

    it('steps down on a GPU-bound 60 Hz pattern with low work', () => {
      const { watch, start } = newWatch();
      runIntervals(watch, start, A.onWindowMs + 1000, gpuBound, GPU_WORK);
      expect(watch.level).toBe(1);
      expect(watch.lastCause).toBe('gpu');
    });

    it('never steps down at a steady 30 fps (low power)', () => {
      const { watch, start } = newWatch();
      runIntervals(watch, start, 60_000, () => 1000 / 30, GPU_WORK);
      expect(watch.level).toBe(0);
    });

    it('never steps down at a steady 120 Hz', () => {
      const { watch, start } = newWatch();
      runIntervals(watch, start, 60_000, () => 1000 / 120, GPU_WORK);
      expect(watch.level).toBe(0);
    });

    it('never steps down at a steady 60 fps', () => {
      const { watch, start } = newWatch();
      runIntervals(watch, start, 60_000, () => FRAME_60, GPU_WORK);
      expect(watch.level).toBe(0);
    });

    it('does not step up before the hold has passed, steps up after it', () => {
      const { watch, start } = newWatch();
      let t = runIntervals(watch, start, A.onWindowMs + 1000, gpuBound, GPU_WORK);
      expect(watch.level).toBe(1);
      const downAt = t;
      // Calm frames: the recovery window and the switch gap are over, the hold is not.
      t = runIntervals(watch, t, A.gpuUpHoldMs - 5000, () => FRAME_60, FAST_WORK);
      expect(t - downAt).toBeLessThan(A.gpuUpHoldMs);
      expect(watch.level).toBe(1);
      runIntervals(watch, t, 10_000, () => FRAME_60, FAST_WORK);
      expect(watch.level).toBe(0);
    });

    it('does not step up while late frames continue', () => {
      const { watch, start } = newWatch();
      const t = runIntervals(watch, start, A.onWindowMs + 1000, gpuBound, GPU_WORK);
      runIntervals(watch, t, A.gpuUpHoldMs + 30_000, gpuBound, GPU_WORK);
      expect(watch.level).toBeGreaterThanOrEqual(1);
    });

    it('does not count high-work frames with long intervals for the GPU signal', () => {
      const { watch, start } = newWatch();
      // Over budget in half of the frames: the work signal (95%) does not trip, and those frames
      // are not late, so the GPU signal does not trip either.
      runIntervals(watch, start, 30_000, gpuBound, A.budgetMs + 2);
      // All frames over budget: only the work signal steps down.
      const other = newWatch();
      runIntervals(other.watch, other.start, A.onWindowMs + 1000, gpuBound, A.budgetMs + 2);
      expect(other.watch.level).toBe(1);
      expect(other.watch.lastCause).toBe('work');
    });
  });

  describe('with two steps down', () => {
    function newSteppedWatch(): { watch: FrameWorkWatch; start: number } {
      const watch = new FrameWorkWatch(OPTIONS, 2);
      watch.restart(0, A.warmUpMs);
      return { watch, start: A.warmUpMs };
    }

    it('steps down one level after a slow window', () => {
      const { watch, start } = newSteppedWatch();
      run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(1);
    });

    it('needs a whole slow window of the new level and the switch gap for the second step', () => {
      const { watch, start } = newSteppedWatch();
      let t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(1);
      // Still slow, but less than the switch gap has passed since the first step.
      const firstStepAt = t;
      while (t - firstStepAt < A.minSwitchGapMs - 3000) {
        t = run(watch, t, 1000, SLOW_FRAME_MS, SLOW_WORK);
      }
      expect(watch.level).toBe(1);
      run(watch, t, 6000, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(2);
    });

    it('never goes below the lowest level', () => {
      const { watch, start } = newSteppedWatch();
      run(watch, start, 3 * A.minSwitchGapMs, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(2);
    });

    it('steps back up one level at a time after calm windows', () => {
      const { watch, start } = newSteppedWatch();
      let t = run(watch, start, 2 * A.minSwitchGapMs, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(2);
      const levels = [2];
      const limit = t + 4 * (A.offWindowMs + A.minSwitchGapMs);
      while (t < limit && watch.level > 0) {
        t = run(watch, t, 1000, FRAME_60, FAST_WORK);
        if (watch.level !== levels[levels.length - 1]) levels.push(watch.level);
      }
      expect(levels).toEqual([2, 1, 0]);
    });

    it('keeps the level in the middle when frames are inside the budget but without the margin', () => {
      const { watch, start } = newSteppedWatch();
      let t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(1);
      t = run(watch, t, 3 * A.minSwitchGapMs, FRAME_60, A.budgetMs - 1);
      expect(watch.level).toBe(1);
      expect(t).toBeGreaterThan(0);
    });

    it('lifts the level to a raised floor at once and never steps back up past it', () => {
      const { watch, start } = newSteppedWatch();
      watch.setFloor(1);
      expect(watch.level).toBe(1);
      // No switch gap is owed for the first step down from the floor: one slow window is enough.
      const t = run(watch, start, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK);
      expect(watch.level).toBe(2);
      run(watch, t, 3 * (A.minSwitchGapMs + A.offWindowMs), FRAME_60, FAST_WORK);
      expect(watch.level).toBe(1);
    });

    it('leaves the level where it is when the floor is lowered, then steps up after a calm window', () => {
      const { watch, start } = newSteppedWatch();
      watch.setFloor(1);
      watch.setFloor(0);
      expect(watch.level).toBe(1);
      run(watch, start, A.offWindowMs + A.minSwitchGapMs, FRAME_60, FAST_WORK);
      expect(watch.level).toBe(0);
    });
  });
});

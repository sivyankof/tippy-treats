import { describe, expect, it } from 'vitest';
import { LowFpsWatch } from './low-fps-watch';

const OPTIONS = { lowFps: 50, windowMs: 2000, hitchMs: 250 };

/** Feeds `ms` worth of frames of `frameMs` each; returns the last answer. */
function run(watch: LowFpsWatch, frameMs: number, ms: number): boolean {
  let low = false;
  for (let t = 0; t < ms; t += frameMs) low = watch.update(frameMs);
  return low;
}

describe('LowFpsWatch', () => {
  it('stays quiet at 60 fps', () => {
    expect(run(new LowFpsWatch(OPTIONS), 1000 / 60, 10_000)).toBe(false);
  });

  it('fires once 40 fps lasted the whole window, not earlier', () => {
    const watch = new LowFpsWatch(OPTIONS);
    expect(run(watch, 25, 1900)).toBe(false);
    expect(run(watch, 25, 200)).toBe(true);
  });

  it('forgets slow frames that left the window', () => {
    const watch = new LowFpsWatch(OPTIONS);
    run(watch, 25, 1500);
    expect(run(watch, 1000 / 60, 3000)).toBe(false);
  });

  it('ignores a single slow frame among fast ones', () => {
    const watch = new LowFpsWatch(OPTIONS);
    run(watch, 1000 / 60, 1000);
    watch.update(200);
    expect(run(watch, 1000 / 60, 1500)).toBe(false);
  });

  it('treats a hitch as a restart of the window', () => {
    const watch = new LowFpsWatch(OPTIONS);
    run(watch, 25, 1900);
    expect(watch.update(1000)).toBe(false);
    expect(run(watch, 25, 1000)).toBe(false);
    expect(run(watch, 25, 1100)).toBe(true);
  });

  it('ignores empty frames', () => {
    const watch = new LowFpsWatch(OPTIONS);
    expect(watch.update(0)).toBe(false);
  });
});

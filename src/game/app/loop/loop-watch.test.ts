import { describe, expect, it } from 'vitest';
import { LoopWatch } from './loop-watch';

const LIMITS = { stallMs: 1500, lateMs: 1000, restartsMax: 2, restartGapMs: 5000 };

/** Checks every 500 ms with a frame counter that stands still. */
function stalledChecks(watch: LoopWatch, from: number, to: number): string[] {
  const out: string[] = [];
  for (let t = from; t <= to; t += 500) out.push(watch.check(t, 10, true));
  return out;
}

describe('LoopWatch', () => {
  it('leaves a moving loop alone', () => {
    const watch = new LoopWatch(LIMITS);
    for (let i = 0; i < 40; i++) expect(watch.check(i * 500, i * 30, true)).toBe('ok');
  });

  it('restarts when the counter stands still for stallMs', () => {
    const watch = new LoopWatch(LIMITS);
    expect(stalledChecks(watch, 0, 1500)).toEqual(['ok', 'ok', 'ok', 'restart']);
    expect(watch.restartCount).toBe(1);
  });

  it('does nothing while the loop is meant to stand still', () => {
    const watch = new LoopWatch(LIMITS);
    for (let t = 0; t <= 20000; t += 500) expect(watch.check(t, 10, false)).toBe('ok');
    // The count starts over when it becomes active again.
    expect(watch.check(20500, 10, true)).toBe('ok');
    expect(watch.check(21500, 10, true)).toBe('ok');
    expect(watch.check(22000, 10, true)).toBe('restart');
  });

  it('takes a late check for a busy page, not a dead loop', () => {
    const watch = new LoopWatch(LIMITS);
    watch.check(0, 10, true);
    expect(watch.check(4000, 10, true)).toBe('ok');
    expect(watch.check(4500, 10, true)).toBe('ok');
    expect(watch.check(5000, 10, true)).toBe('ok');
    expect(watch.check(5500, 10, true)).toBe('restart');
  });

  it('keeps the gap between restarts and gives up once the limit is spent', () => {
    const watch = new LoopWatch(LIMITS);
    const verdicts = stalledChecks(watch, 0, 20000);
    const at = (v: string): number[] =>
      verdicts.map((x, i) => (x === v ? i * 500 : -1)).filter((x) => x >= 0);
    expect(at('restart')).toEqual([1500, 6500]);
    expect(at('give-up')).toEqual([8000]);
    // After that the watchdog never touches the loop again.
    expect(watch.check(30000, 10, true)).toBe('ok');
    expect(watch.restartCount).toBe(2);
  });

  it('is quiet after a restart that worked', () => {
    const watch = new LoopWatch(LIMITS);
    stalledChecks(watch, 0, 1500);
    for (let i = 0; i < 20; i++) expect(watch.check(2000 + i * 500, 11 + i * 30, true)).toBe('ok');
  });
});

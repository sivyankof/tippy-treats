import { describe, expect, it } from 'vitest';
import { MusicWatchdog, type WatchInput } from './music-watchdog';

const cfg = { silentMs: 3000, loadingMaxMs: 15000, minGapMs: 8000, maxGapMs: 60000 };
const silent = (nowMs: number, extra: Partial<WatchInput> = {}): WatchInput => ({
  wanted: true,
  audible: false,
  loading: false,
  nowMs,
  ...extra,
});

/** The times (ms, every 500 ms up to `untilMs`) at which the watchdog restarts. */
function restarts(dog: MusicWatchdog, untilMs: number, input = silent): number[] {
  const at: number[] = [];
  for (let t = 0; t <= untilMs; t += 500) if (dog.check(input(t))) at.push(t);
  return at;
}

describe('MusicWatchdog', () => {
  it('restarts a silent playlist after 3 s, then no closer than the gap, the gap doubling', () => {
    expect(restarts(new MusicWatchdog(cfg), 40_000)).toEqual([3000, 11_000, 27_000]);
  });

  it('never restarts while the music is heard, not wanted, or loading for less than the limit', () => {
    const dog = new MusicWatchdog(cfg);
    expect(restarts(dog, 20_000, (t) => silent(t, { audible: true }))).toEqual([]);
    expect(restarts(dog, 20_000, (t) => silent(t, { wanted: false }))).toEqual([]);
    const loading = (t: number): WatchInput => silent(t, { loading: true });
    expect(restarts(new MusicWatchdog(cfg), 14_500, loading)).toEqual([]);
    expect(restarts(new MusicWatchdog(cfg), 15_000, loading)).toEqual([15_000]);
  });

  it('a moment of sound starts the silence count again', () => {
    const dog = new MusicWatchdog(cfg);
    expect(dog.check(silent(0))).toBe(false);
    expect(dog.check(silent(2500))).toBe(false);
    expect(dog.check(silent(2600, { audible: true }))).toBe(false);
    expect(dog.check(silent(5000))).toBe(false);
    expect(dog.check(silent(8000))).toBe(true);
    expect(dog.restarts).toBe(1);
  });

  it('reset forgets the last restart', () => {
    const dog = new MusicWatchdog(cfg);
    expect(restarts(dog, 3000)).toEqual([3000]);
    dog.reset();
    expect(dog.check(silent(4000))).toBe(false);
    expect(dog.check(silent(7000))).toBe(true);
  });
});

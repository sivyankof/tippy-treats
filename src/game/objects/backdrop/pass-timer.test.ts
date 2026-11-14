import { describe, expect, it } from 'vitest';
import { BACKDROP_LIFE } from '../../../data/backdrop-life';
import { edgeFade, PassTimer } from './pass-timer';

const spec = {
  moveMs: [1000, 1000],
  intervalMs: [4000, 4000],
  initialDelayMs: [2000, 2000],
} as const;
const low = (): number => 0;

describe('PassTimer', () => {
  it('waits for the initial delay, then runs a pass and rests', () => {
    const timer = new PassTimer(spec, low);
    timer.update(1999);
    expect(timer.active).toBe(false);
    timer.update(1);
    expect(timer.active).toBe(true);
    expect(timer.started).toBe(true);
    expect(timer.progress).toBe(0);
    timer.update(500);
    expect(timer.started).toBe(false);
    expect(timer.progress).toBeCloseTo(0.5, 10);
    timer.update(500);
    expect(timer.active).toBe(false);
    timer.update(2999);
    expect(timer.active).toBe(false);
    timer.update(1);
    expect(timer.active).toBe(true);
    expect(timer.started).toBe(true);
  });

  it('starts inside the first pass for a negative initial delay', () => {
    const timer = new PassTimer({ ...spec, initialDelayMs: [-500, -500] }, low);
    timer.update(0);
    expect(timer.active).toBe(true);
    expect(timer.progress).toBeCloseTo(0.5, 10);
  });

  it('never cuts a pass short when the interval is shorter than the pass', () => {
    const timer = new PassTimer(
      { moveMs: [3000, 3000], intervalMs: [1000, 1000], initialDelayMs: [0, 0] },
      low,
    );
    timer.update(2999);
    expect(timer.active).toBe(true);
    timer.update(2);
    expect(timer.started).toBe(true);
    expect(timer.progress).toBeCloseTo(1 / 3000, 6);
  });

  it('survives a very long frame', () => {
    const timer = new PassTimer(spec, low);
    timer.update(100_000);
    expect(timer.progress).toBeGreaterThanOrEqual(0);
    expect(timer.progress).toBeLessThanOrEqual(1);
  });
});

describe('shooting star schedule', () => {
  it('starts a pass every 6 to 10 seconds, start to start (docs/06, section 5)', () => {
    const { intervalMs } = BACKDROP_LIFE.stars.shooting;
    expect(intervalMs[0]).toBe(6000);
    expect(intervalMs[1]).toBe(10000);
    const timer = new PassTimer(BACKDROP_LIFE.stars.shooting);
    const starts: number[] = [];
    let now = 0;
    for (let i = 0; i < 60 * 120; i++) {
      timer.update(1000 / 60);
      now += 1000 / 60;
      if (timer.started) starts.push(now);
    }
    expect(starts.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < starts.length; i++) {
      const gap = (starts[i] ?? 0) - (starts[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(5990);
      expect(gap).toBeLessThanOrEqual(10020);
    }
  });
});

describe('edgeFade', () => {
  it('is 0 at the ends, 1 in the middle and ramps over the edge', () => {
    expect(edgeFade(0, 0.2)).toBe(0);
    expect(edgeFade(1, 0.2)).toBe(0);
    expect(edgeFade(0.5, 0.2)).toBe(1);
    expect(edgeFade(0.1, 0.2)).toBeCloseTo(0.5, 10);
    expect(edgeFade(0.9, 0.2)).toBeCloseTo(0.5, 10);
    expect(edgeFade(0, 0)).toBe(1);
  });
});

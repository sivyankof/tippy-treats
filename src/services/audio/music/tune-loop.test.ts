import { describe, expect, it } from 'vitest';
import {
  decodedBytes,
  equalPowerLevel,
  fadeParam,
  framesAt,
  loopBounds,
  smoothSeam,
} from './tune-loop';

const TRACK = { frames: 441_000, sampleRate: 44_100 };
const PRIMING = 2112;
const SEAM = { fit: 16, radius: 2 };

describe('framesAt and decodedBytes', () => {
  it('scale the source length to the context rate', () => {
    expect(framesAt(TRACK, 44_100)).toBe(441_000);
    expect(framesAt(TRACK, 48_000)).toBe(480_000);
    expect(decodedBytes(TRACK, 48_000)).toBe(480_000 * 2 * 4);
  });
});

describe('loopBounds', () => {
  it('a buffer of the source length loops whole', () => {
    expect(loopBounds(441_000, TRACK, 44_100, PRIMING)).toEqual({ start: 0, end: 441_000 });
  });

  it('padding at the end is skipped', () => {
    expect(loopBounds(441_600, TRACK, 44_100, PRIMING)).toEqual({ start: 0, end: 441_000 });
  });

  it('a kept encoder delay is skipped at the start', () => {
    const decoded = 441_000 + PRIMING + 700;
    expect(loopBounds(decoded, TRACK, 44_100, PRIMING)).toEqual({
      start: PRIMING,
      end: PRIMING + 441_000,
    });
  });

  it('scales the delay to the context rate', () => {
    const decoded = 480_000 + 2299 + 10;
    expect(loopBounds(decoded, TRACK, 48_000, PRIMING)).toEqual({
      start: 2299,
      end: 2299 + 480_000,
    });
  });

  it('a buffer a few samples short of the source loops to its end', () => {
    expect(loopBounds(440_983, TRACK, 44_100, PRIMING)).toEqual({ start: 0, end: 440_983 });
  });
});

/** Largest neighbour step around index `at` (the seam when the buffer wraps). */
function wrapStep(data: Float32Array, start: number, end: number): number {
  const last = data[end - 1] ?? 0;
  return Math.abs((data[start] ?? 0) - last);
}

describe('smoothSeam', () => {
  it('turns a jump at the loop point into a step no bigger than the wave’s own', () => {
    const n = 4800;
    const data = new Float32Array(n);
    // A slow sine cut mid-cycle, with an offset jump at the end: a click when it wraps.
    for (let i = 0; i < n; i++) data[i] = 0.5 * Math.sin((2 * Math.PI * 3.3 * i) / n);
    const ownStep = (2 * Math.PI * 3.3 * 0.5) / n;
    expect(wrapStep(data, 0, n)).toBeGreaterThan(20 * ownStep);
    smoothSeam(data, 0, n, 480, SEAM);
    expect(wrapStep(data, 0, n)).toBeLessThan(2 * ownStep);
  });

  it('leaves everything before the smoothed tail untouched', () => {
    const data = Float32Array.from({ length: 1000 }, (_, i) => i / 1000);
    const copy = data.slice();
    smoothSeam(data, 0, 1000, 100, SEAM);
    for (let i = 0; i < 900; i++) expect(data[i]).toBe(copy[i]);
  });

  it('a continuous loop is left as it is', () => {
    const n = 4800;
    const data = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 5 * i) / n));
    const copy = data.slice();
    smoothSeam(data, 0, n, 480, SEAM);
    for (let i = 0; i < n; i++) expect(data[i]).toBeCloseTo(copy[i] ?? 0, 3);
  });

  it('works inside bounds that skip a delay', () => {
    const data = new Float32Array(1000).fill(0.3);
    data.fill(0.1, 0, 100);
    smoothSeam(data, 100, 900, 50, SEAM);
    expect(data[899]).toBeCloseTo(0.3, 5);
    expect(data[950]).toBeCloseTo(0.3, 6);
  });
});

describe('equalPowerLevel', () => {
  it('a fade in and a fade out keep their summed power', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const a = equalPowerLevel(0, 1, t);
      const b = equalPowerLevel(1, 0, t);
      expect(a * a + b * b).toBeCloseTo(1, 9);
    }
  });

  it('starts at from and ends at to', () => {
    expect(equalPowerLevel(0.3, 1.2, 0)).toBeCloseTo(0.3, 9);
    expect(equalPowerLevel(0.3, 1.2, 1)).toBeCloseTo(1.2, 9);
  });
});

describe('fadeParam', () => {
  it('holds the value now, then ramps in steps along the curve to the target', () => {
    const calls: string[] = [];
    const param = {
      value: 0.5,
      cancelScheduledValues: (t: number) => calls.push(`cancel ${t}`),
      setValueAtTime: (v: number, t: number) => calls.push(`set ${v} ${t}`),
      linearRampToValueAtTime: (v: number, t: number) => calls.push(`ramp ${v.toFixed(3)} ${t}`),
    } as unknown as AudioParam;
    fadeParam(param, 10, 0, 2, 4);
    expect(calls[0]).toBe('cancel 10');
    expect(calls[1]).toBe('set 0.5 10');
    expect(calls).toHaveLength(6);
    expect(calls.at(-1)).toBe('ramp 0.000 12');
  });
});

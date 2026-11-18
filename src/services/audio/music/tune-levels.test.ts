import { describe, expect, it } from 'vitest';
import {
  dcOffset,
  denormalSamples,
  energyShareAbove,
  fft,
  sampleSteps,
  seamDb,
  stretchRmsDb,
} from './tune-levels';

const RATE = 100;

function filled(values: number[]): Float32Array {
  return Float32Array.from(values);
}

describe('tune levels', () => {
  it('measures the RMS of a stretch, silence included', () => {
    const half = filled([...Array<number>(100).fill(0.5), ...Array<number>(100).fill(0)]);
    expect(stretchRmsDb([half], RATE, 0, 1)).toBeCloseTo(20 * Math.log10(0.5), 6);
    expect(stretchRmsDb([half], RATE, 1, 2)).toBe(-Infinity);
    expect(stretchRmsDb([half], RATE, 0.5, 1.5)).toBeCloseTo(20 * Math.log10(Math.sqrt(0.125)), 6);
  });

  it('reads the seam as the level after minus the level before', () => {
    const step = filled([...Array<number>(100).fill(0.1), ...Array<number>(100).fill(0.2)]);
    const seam = seamDb([step], RATE, 1, 0.5);
    expect(seam.diff).toBeCloseTo(20 * Math.log10(2), 6);
  });

  it('finds a DC offset and denormal samples', () => {
    expect(dcOffset([filled([1, -1, 1, -1])])).toBe(0);
    expect(dcOffset([filled([0.5, 0.5])])).toBeCloseTo(0.5, 6);
    expect(denormalSamples([filled([0, 1e-40, 1e-3, -1e-41])])).toBe(2);
  });

  it('fft finds a sine in its bin', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 5 * i) / n);
    fft(re, im);
    const mags = Array.from(re, (r, k) => Math.hypot(r, im[k] ?? 0));
    expect(mags[5]).toBeCloseTo(n / 2, 6);
    expect(mags[3]).toBeLessThan(1e-9);
  });

  it('energyShareAbove: none for a low sine, nearly all for a high one, half for equal parts', () => {
    const rate = 44_100;
    const sine = (hz: number, amp = 1) =>
      Float32Array.from({ length: rate }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));
    expect(energyShareAbove(sine(1000), rate, 6000)).toBeLessThan(0.001);
    expect(energyShareAbove(sine(10_000), rate, 6000)).toBeGreaterThan(0.999);
    const low = sine(1000);
    const high = sine(10_000);
    const both = Float32Array.from(low, (v, i) => v + (high[i] ?? 0));
    expect(energyShareAbove(both, rate, 6000)).toBeCloseTo(0.5, 2);
    expect(energyShareAbove(new Float32Array(10), rate, 6000)).toBe(0);
  });

  it('sampleSteps shows a click as a step far above the usual ones', () => {
    const smooth = Float32Array.from({ length: 20_000 }, (_, i) => 0.3 * Math.sin(i / 50));
    const calm = sampleSteps([smooth]);
    expect(calm.max).toBeLessThan(0.01);
    const clicked = Float32Array.from(smooth);
    clicked[10_000] = 0.9;
    const click = sampleSteps([clicked]);
    expect(click.max).toBeGreaterThan(0.5);
    expect(click.quantile).toBeLessThan(0.01);
  });
});

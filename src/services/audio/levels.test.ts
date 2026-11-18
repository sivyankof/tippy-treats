import { describe, expect, it } from 'vitest';
import { clippedSamples, durationAboveFloor, fromDb, peakDb, rmsDb, toDb } from './levels';

describe('levels', () => {
  it('converts between amplitude and dB', () => {
    expect(toDb(1)).toBeCloseTo(0);
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(toDb(0)).toBe(-Infinity);
    expect(fromDb(-20)).toBeCloseTo(0.1);
  });

  it('reads the peak over all channels', () => {
    const peak = peakDb([new Float32Array([0.1, -0.25]), new Float32Array([0.5, 0])]);
    expect(peak).toBeCloseTo(toDb(0.5));
    expect(peakDb([new Float32Array(4)])).toBe(-Infinity);
  });

  it('computes the RMS of the sounding part only', () => {
    const loud = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const padded = new Float32Array([0, 0, 0, 0, 0.5, -0.5, 0.5, -0.5, 0, 0, 0, 0]);
    expect(rmsDb([loud])).toBeCloseTo(toDb(0.5));
    expect(rmsDb([padded])).toBeCloseTo(toDb(0.5));
    expect(rmsDb([new Float32Array(8)])).toBe(-Infinity);
    expect(rmsDb([])).toBe(-Infinity);
  });

  it('counts samples at full scale or beyond', () => {
    expect(clippedSamples([new Float32Array([1, -1, 0.99, 1.2]), new Float32Array([0, 1])])).toBe(
      4,
    );
  });

  it('measures the duration above the floor', () => {
    const data = new Float32Array(100);
    data[39] = 0.2;
    data[80] = 0.0001;
    expect(durationAboveFloor([data], 100)).toBeCloseTo(0.4);
    expect(durationAboveFloor([new Float32Array(10)], 100)).toBe(0);
  });
});

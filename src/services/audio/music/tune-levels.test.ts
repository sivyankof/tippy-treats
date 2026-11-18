import { describe, expect, it } from 'vitest';
import { dcOffset, denormalSamples, seamDb, stretchRmsDb } from './tune-levels';

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
});

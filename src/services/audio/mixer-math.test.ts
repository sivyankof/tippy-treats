import { describe, expect, it } from 'vitest';
import { duckFactor, limiterCurve, musicAudible, musicTarget, type DuckReason } from './mixer-math';

describe('duck level', () => {
  it('is 1 with no reason and 1 - share with any', () => {
    expect(duckFactor(new Set<DuckReason>(), 0.4)).toBe(1);
    expect(duckFactor(new Set<DuckReason>(['window']), 0.4)).toBeCloseTo(0.6);
  });

  it('does not stack reasons', () => {
    expect(duckFactor(new Set<DuckReason>(['window', 'record']), 0.4)).toBeCloseTo(0.6);
  });

  it('gives the music bus target', () => {
    const none = new Set<DuckReason>();
    expect(musicTarget(true, 0.5, none, 0.4)).toBe(0.5);
    expect(musicTarget(true, 0.5, new Set<DuckReason>(['record']), 0.4)).toBeCloseTo(0.3);
    expect(musicTarget(false, 0.5, none, 0.4)).toBe(0);
  });
});

describe('limiterCurve', () => {
  const size = 4097;
  const curve = limiterCurve(size, 0.7, 0.98);
  const at = (x: number): number => curve[Math.round(((x + 1) / 2) * (size - 1))] ?? NaN;

  it('leaves the signal alone up to the threshold', () => {
    for (const x of [-0.7, -0.3, 0, 0.1, 0.5, 0.7]) expect(at(x)).toBeCloseTo(x, 3);
  });

  it('bends above the threshold and stays under the ceiling', () => {
    expect(at(0.85)).toBeLessThan(0.85);
    expect(at(0.85)).toBeGreaterThan(0.7);
    expect(at(1)).toBeLessThan(0.98);
    expect(at(1)).toBeGreaterThan(0.9);
  });

  it('is odd and rising', () => {
    expect(at(-0.9)).toBeCloseTo(-at(0.9), 5);
    for (let i = 1; i < size; i++) expect(curve[i]!).toBeGreaterThan(curve[i - 1]!);
  });
});

describe('musicAudible', () => {
  it('needs a playing tune, the switch on and a level above zero', () => {
    expect(musicAudible(true, true, 1)).toBe(true);
    expect(musicAudible(false, true, 1)).toBe(false);
    expect(musicAudible(true, false, 1)).toBe(false);
    expect(musicAudible(true, true, 0)).toBe(false);
  });
});

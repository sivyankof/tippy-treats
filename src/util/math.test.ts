import { describe, expect, it } from 'vitest';
import {
  clamp01,
  frameLerp,
  oscillate01,
  pickInt,
  pickRange,
  randomSeed,
  REFERENCE_FRAME_MS,
  sineWave,
  smoothstep,
  TWO_PI,
  UINT32_RANGE,
} from './math';

describe('math helpers', () => {
  it('has a full turn of 2 pi', () => {
    expect(TWO_PI).toBeCloseTo(6.283185307, 8);
  });

  it('keeps random seeds inside the uint32 domain', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.5)).toBe(UINT32_RANGE / 2);
    expect(randomSeed(() => 1 - Number.EPSILON)).toBeLessThan(UINT32_RANGE);
    expect(Number.isInteger(randomSeed())).toBe(true);
  });

  it('smooths per 60 Hz frame regardless of the frame length', () => {
    expect(frameLerp(0.12, REFERENCE_FRAME_MS)).toBeCloseTo(0.12, 10);
    expect(frameLerp(0.12, 0)).toBe(0);
    // Two 60 Hz frames equal one 30 Hz frame.
    const twice = 1 - (1 - frameLerp(0.2, 1000 / 60)) ** 2;
    expect(frameLerp(0.2, 2000 / 60)).toBeCloseTo(twice, 10);
  });

  it('runs sine waves with the given period and phase', () => {
    expect(sineWave(0, 1000)).toBeCloseTo(0, 10);
    expect(sineWave(250, 1000)).toBeCloseTo(1, 10);
    expect(sineWave(1250, 1000)).toBeCloseTo(sineWave(250, 1000), 10);
    expect(sineWave(0, 1000, Math.PI / 2)).toBeCloseTo(1, 10);
  });

  it('keeps the 0..1 oscillator between 0 and 1', () => {
    expect(oscillate01(0, 800)).toBeCloseTo(0.5, 10);
    expect(oscillate01(200, 800)).toBeCloseTo(1, 10);
    expect(oscillate01(600, 800)).toBeCloseTo(0, 10);
    // A quarter turn back starts at the bottom, like an eased back-and-forth.
    expect(oscillate01(0, 800, -Math.PI / 2)).toBeCloseTo(0, 10);
    expect(oscillate01(400, 800, -Math.PI / 2)).toBeCloseTo(1, 10);
  });

  it('picks values inside inclusive ranges', () => {
    expect(pickRange([2, 4], () => 0)).toBe(2);
    expect(pickRange([2, 4], () => 0.5)).toBe(3);
    expect(pickInt([6, 8], () => 0)).toBe(6);
    expect(pickInt([6, 8], () => 0.999)).toBe(8);
    expect(pickInt([6, 8], () => 1)).toBe(8);
    expect(pickInt([10, 14], () => 0.5)).toBe(12);
  });
});

describe('clamp01 and smoothstep', () => {
  it('limits a value to 0..1', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
  });

  it('eases in and out', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
    expect(smoothstep(0.1)).toBeLessThan(0.1);
    expect(smoothstep(2)).toBe(1);
  });
});

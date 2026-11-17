import { describe, expect, it } from 'vitest';
import { flashEnvelope, nextBoltAt, particleFade, wrapRange } from './weather-motion';

describe('weather motion', () => {
  it('wraps values into the padded range', () => {
    expect(wrapRange(-30, 100, 20)).toBe(-30 + 140);
    expect(wrapRange(130, 100, 20)).toBe(-10);
    expect(wrapRange(50, 100, 20)).toBe(50);
  });

  it('hides particles inside the flight stripe and fades them in beside it', () => {
    const band = { top: 400, bottom: 600 };
    expect(particleFade(500, band, 70, 1000, 60)).toBe(0);
    expect(particleFade(365, band, 70, 1000, 60)).toBeCloseTo(0.5);
    expect(particleFade(100, band, 70, 1000, 60)).toBe(1);
    expect(particleFade(800, band, 70, 1000, 60)).toBe(1);
    expect(particleFade(10, band, 70, 1000, 60)).toBeCloseTo(10 / 60);
  });

  it('places the next bolt inside the pause range', () => {
    expect(nextBoltAt(1000, [8000, 15000], 0)).toBe(9000);
    expect(nextBoltAt(1000, [8000, 15000], 1)).toBe(16000);
  });

  it('rises quickly and falls slowly', () => {
    expect(flashEnvelope(-1, 150)).toBe(0);
    expect(flashEnvelope(30, 150)).toBeCloseTo(1);
    expect(flashEnvelope(150, 150)).toBe(0);
    expect(flashEnvelope(90, 150)).toBeGreaterThan(0);
    expect(flashEnvelope(90, 150)).toBeLessThan(1);
  });
});

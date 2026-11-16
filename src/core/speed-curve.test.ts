import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { speedCurve } from './speed-curve';

describe('speedCurve', () => {
  it('matches the control values of docs/02', () => {
    const control: [number, number][] = [
      [0, 600],
      [10, 690],
      [40, 960],
      [60, 1094],
      [80, 1204],
      [100, 1290],
      [120, 1351],
      [140, 1388],
      [160, 1400],
    ];
    for (const [height, speed] of control) expect(Math.round(speedCurve(height))).toBe(speed);
  });

  it('keeps the linear part continuous with the arc', () => {
    const { base, perLayer, arcFrom, arcStart } = BALANCE.speed;
    expect(base + perLayer * arcFrom).toBe(arcStart);
    expect(speedCurve(arcFrom + 1e-9)).toBeCloseTo(speedCurve(arcFrom), 5);
    // The arc starts slower than the line (slope 2 * 440 / 120 < 9): no jump, no kink upwards.
    expect(speedCurve(arcFrom + 1) - speedCurve(arcFrom)).toBeLessThan(perLayer);
  });

  it('never decreases and grows ever slower inside the arc', () => {
    let previous = speedCurve(0);
    let previousStep = Infinity;
    for (let h = 1; h <= 400; h++) {
      const speed = speedCurve(h);
      const step = speed - previous;
      expect(step).toBeGreaterThanOrEqual(0);
      if (h > BALANCE.speed.arcFrom) expect(step).toBeLessThanOrEqual(previousStep + 1e-9);
      if (h > BALANCE.speed.arcFrom) previousStep = step;
      previous = speed;
    }
  });

  it('reaches the ceiling at arcTo and stays there', () => {
    const { arcTo, max } = BALANCE.speed;
    expect(speedCurve(arcTo)).toBe(max);
    expect(speedCurve(arcTo + 1)).toBe(max);
    expect(speedCurve(10_000)).toBe(max);
    expect(speedCurve(arcTo - 1)).toBeLessThan(max);
  });
});

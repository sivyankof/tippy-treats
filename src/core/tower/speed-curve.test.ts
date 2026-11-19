import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { speedCurve } from './speed-curve';

describe('speedCurve', () => {
  it('matches the control values of docs/02', () => {
    const control: [number, number][] = [
      [0, 600],
      [20, 752],
      [40, 884],
      [60, 996],
      [80, 1088],
      [100, 1159],
      [120, 1209],
      [140, 1240],
      [160, 1250],
    ];
    for (const [height, speed] of control) expect(Math.round(speedCurve(height))).toBe(speed);
  });

  it('never decreases and grows ever slower along the whole arc', () => {
    let previous = speedCurve(0);
    let previousStep = Infinity;
    for (let h = 1; h <= 400; h++) {
      const speed = speedCurve(h);
      const step = speed - previous;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(previousStep + 1e-9);
      previousStep = step;
      previous = speed;
    }
  });

  it('reaches the ceiling at arcTo with no jump and stays there', () => {
    const { arcTo, max } = BALANCE.speed;
    expect(speedCurve(arcTo)).toBe(max);
    expect(speedCurve(arcTo + 1)).toBe(max);
    expect(speedCurve(10_000)).toBe(max);
    expect(speedCurve(arcTo - 1)).toBeLessThan(max);
    expect(max - speedCurve(arcTo - 1)).toBeLessThan(0.1);
  });
});

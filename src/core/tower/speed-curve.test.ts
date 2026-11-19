import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { speedCurve } from './speed-curve';

/** The largest step between two neighbouring heights the curve may make, px/s. */
const MAX_STEP = 11;

describe('speedCurve', () => {
  it('matches the control values of docs/02', () => {
    const control: [number, number][] = [
      [0, 540],
      [20, 699],
      [40, 839],
      [60, 959],
      [80, 1060],
      [100, 1140],
      [120, 1199],
      [140, 1236],
      [160, 1250],
    ];
    for (const [height, speed] of control) expect(Math.round(speedCurve(height))).toBe(speed);
  });

  it('is one arc from the first layer: start, power and the ceiling from BALANCE.speed', () => {
    const { start, top, arcTo, power } = BALANCE.speed;
    expect(speedCurve(0)).toBe(start);
    for (const h of [1, 17, 40, 41, 99, 159]) {
      expect(speedCurve(h)).toBeCloseTo(start + (top - start) * (1 - (1 - h / arcTo) ** power), 9);
    }
  });

  it(`never decreases, grows ever slower and never steps more than ${MAX_STEP} between layers`, () => {
    let previous = speedCurve(0);
    let previousStep = Infinity;
    for (let h = 1; h <= 400; h++) {
      const speed = speedCurve(h);
      const step = speed - previous;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(MAX_STEP);
      expect(step).toBeLessThanOrEqual(previousStep + 1e-9);
      previousStep = step;
      previous = speed;
    }
  });

  it('has no bend at the 40th layer: the steps around it differ by a fraction of one', () => {
    const step = (h: number): number => speedCurve(h) - speedCurve(h - 1);
    expect(Math.abs(step(41) - step(40))).toBeLessThan(0.1);
    expect(Math.abs(step(40) - step(39))).toBeLessThan(0.1);
  });

  it('reaches the ceiling at arcTo smoothly and stays there', () => {
    const { arcTo, top } = BALANCE.speed;
    expect(speedCurve(arcTo)).toBe(top);
    expect(speedCurve(arcTo + 1)).toBe(top);
    expect(speedCurve(10_000)).toBe(top);
    expect(speedCurve(arcTo - 1)).toBeLessThan(top);
    expect(top - speedCurve(arcTo - 1)).toBeLessThan(1);
  });
});

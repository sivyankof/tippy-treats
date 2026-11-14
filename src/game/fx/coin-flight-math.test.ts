import { describe, expect, it } from 'vitest';
import {
  arcPoint,
  flightLifeMs,
  hopHeight,
  sampleFlight,
  shownTotal,
  spinScale,
  splitAmount,
  type FlightFrame,
  type FlightPlan,
} from './coin-flight-math';

const plan: FlightPlan = {
  delayMs: 100,
  hopMs: 150,
  hopPx: 70,
  flightMs: 450,
  arcPx: 150,
  startScale: 1,
  endScale: 0.8,
};
const from = { x: 200, y: 900 };
const to = { x: 1000, y: 72 };
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

const frame = (): FlightFrame => ({ x: 0, y: 0, scale: 1, visible: false, done: false });

describe('splitAmount', () => {
  it('keeps the total and never exceeds the cap', () => {
    for (const amount of [1, 2, 7, 10, 13, 100]) {
      const parts = splitAmount(amount, 6);
      expect(sum(parts)).toBe(amount);
      expect(parts.length).toBe(Math.min(amount, 6));
      expect(parts.every((p) => p >= 1)).toBe(true);
    }
  });

  it('shares as evenly as possible, the remainder going to the first coins', () => {
    expect(splitAmount(10, 6)).toEqual([2, 2, 2, 2, 1, 1]);
    expect(splitAmount(3, 6)).toEqual([1, 1, 1]);
  });

  it('has no coins for nothing, or when the cap is zero', () => {
    expect(splitAmount(0, 6)).toEqual([]);
    expect(splitAmount(-3, 6)).toEqual([]);
    expect(splitAmount(5, 0)).toEqual([]);
  });

  it('rounds a fractional amount', () => {
    expect(sum(splitAmount(2.4, 6))).toBe(2);
  });
});

describe('arcPoint', () => {
  it('starts and ends on the endpoints', () => {
    const out = { x: 0, y: 0 };
    expect(arcPoint(from, to, 0, 150, out)).toEqual(from);
    expect(arcPoint(from, to, 1, 150, out).x).toBeCloseTo(to.x);
    expect(out.y).toBeCloseTo(to.y);
  });

  it('bulges up by the arc height in the middle', () => {
    const out = arcPoint(from, to, 0.5, 150, { x: 0, y: 0 });
    expect(out.x).toBeCloseTo((from.x + to.x) / 2);
    expect(out.y).toBeCloseTo((from.y + to.y) / 2 - 150);
  });

  it('clamps progress outside 0..1', () => {
    expect(arcPoint(from, to, -1, 150, { x: 0, y: 0 })).toEqual(from);
  });
});

describe('hopHeight and spinScale', () => {
  it('rises and falls back', () => {
    expect(hopHeight(0, 70)).toBeCloseTo(0);
    expect(hopHeight(0.5, 70)).toBeCloseTo(70);
    expect(hopHeight(1, 70)).toBeCloseTo(0);
  });

  it('squashes the coin between the minimum and full width', () => {
    expect(spinScale(0, 1000, 0.1)).toBeCloseTo(1);
    expect(spinScale(500, 1000, 0.1)).toBeCloseTo(0.1);
    for (let t = 0; t < 2000; t += 37) {
      const s = spinScale(t, 1000, 0.1);
      expect(s).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(s).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('sampleFlight', () => {
  const scratch = { x: 0, y: 0 };

  it('waits out the delay unseen', () => {
    const f = sampleFlight(plan, from, to, 50, frame(), scratch);
    expect(f.visible).toBe(false);
    expect(f.done).toBe(false);
  });

  it('hops where it lies, then flies to the target in the flight time', () => {
    const hop = sampleFlight(plan, from, to, plan.delayMs + plan.hopMs / 2, frame(), scratch);
    expect(hop.visible).toBe(true);
    expect(hop.x).toBe(from.x);
    expect(hop.y).toBeCloseTo(from.y - plan.hopPx);

    const flightStart = plan.delayMs + plan.hopMs;
    const start = sampleFlight(plan, from, to, flightStart, frame(), scratch);
    expect([start.x, start.y]).toEqual([from.x, from.y]);
    const end = sampleFlight(plan, from, to, flightStart + plan.flightMs - 1, frame(), scratch);
    expect(end.x).toBeCloseTo(to.x, 0);
    expect(end.scale).toBeCloseTo(plan.endScale, 1);
  });

  it('is done exactly at its life time', () => {
    const life = flightLifeMs(plan);
    expect(life).toBe(plan.delayMs + plan.hopMs + plan.flightMs);
    expect(sampleFlight(plan, from, to, life - 1, frame(), scratch).done).toBe(false);
    expect(sampleFlight(plan, from, to, life, frame(), scratch).done).toBe(true);
  });

  it('flies at once when there is no hop', () => {
    const noHop = { ...plan, delayMs: 0, hopMs: 0 };
    const f = sampleFlight(noHop, from, to, 225, frame(), scratch);
    expect(f.visible).toBe(true);
    expect(f.x).toBeGreaterThan(from.x);
  });
});

describe('shownTotal', () => {
  it('holds back what is still flying and ends on the total', () => {
    expect(shownTotal(12, 0)).toBe(12);
    expect(shownTotal(12, 10)).toBe(2);
    expect(shownTotal(12, 12)).toBe(0);
  });

  it('never goes negative', () => {
    expect(shownTotal(3, 10)).toBe(0);
    expect(shownTotal(3, -2)).toBe(3);
  });

  it('rises step by step as flights arrive and lands on the total', () => {
    const total = 13;
    const parts = splitAmount(10, 6).concat(splitAmount(3, 6));
    let pending = sum(parts);
    const seen: number[] = [shownTotal(total, pending)];
    for (const part of parts) {
      pending -= part;
      seen.push(shownTotal(total, pending));
    }
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(total);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});

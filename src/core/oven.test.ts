import { describe, expect, it } from 'vitest';
import { OVEN } from '../data/progression';
import { bakeLayers, freshLeft, type OvenState } from './oven';

const EMPTY: OvenState = { day: '', used: 0, carry: 0 };
const DAY1 = '2026-11-10';
const DAY2 = '2026-11-11';

describe('bakeLayers', () => {
  it('pays 1 XP per layer while the oven is fresh', () => {
    const r = bakeLayers(EMPTY, 100, DAY1, false);
    expect(r.xp).toBe(100);
    expect(r.oven).toEqual({ day: DAY1, used: 100, carry: 0 });
    expect(r.before).toBe(OVEN.freshLayers);
    expect(r.after).toBe(OVEN.freshLayers - 100);
  });

  it('pays 1 XP per 6 layers once the fresh layers are spent, carrying the rest', () => {
    const spent: OvenState = { day: DAY1, used: OVEN.freshLayers, carry: 0 };
    const r = bakeLayers(spent, 20, DAY1, false);
    expect(r.xp).toBe(3);
    expect(r.oven.carry).toBe(2);
    expect(r.after).toBe(0);
  });

  it('splits one run across the end of the fresh layers', () => {
    const near: OvenState = { day: DAY1, used: OVEN.freshLayers - 10, carry: 0 };
    const r = bakeLayers(near, 40, DAY1, false);
    // 10 fresh layers = 10 XP, 30 layers = 5 XP.
    expect(r.xp).toBe(15);
    expect(r.oven).toEqual({ day: DAY1, used: OVEN.freshLayers, carry: 0 });
    expect(r.before).toBe(10);
    expect(r.after).toBe(0);
  });

  it('adds the carried layers to the next run so no layer is lost', () => {
    const spent: OvenState = { day: DAY1, used: OVEN.freshLayers, carry: 0 };
    const first = bakeLayers(spent, 5, DAY1, false);
    expect(first.xp).toBe(0);
    expect(first.oven.carry).toBe(5);
    const second = bakeLayers(first.oven, 5, DAY1, false);
    expect(second.xp).toBe(1);
    expect(second.oven.carry).toBe(4);
  });

  it('keeps the carry over midnight and refills the fresh layers', () => {
    const tired: OvenState = { day: DAY1, used: OVEN.freshLayers, carry: 4 };
    const r = bakeLayers(tired, 3, DAY2, false);
    expect(r.before).toBe(OVEN.freshLayers);
    expect(r.xp).toBe(3);
    expect(r.oven).toEqual({ day: DAY2, used: 3, carry: 4 });
  });

  it('does not start a new day when the clock looks set back', () => {
    const tired: OvenState = { day: DAY2, used: OVEN.freshLayers, carry: 0 };
    expect(bakeLayers(tired, 6, DAY1, false).xp).toBe(1);
    expect(bakeLayers(tired, 6, DAY2, true).xp).toBe(1);
    expect(bakeLayers(tired, 6, DAY2, true).oven.day).toBe(DAY2);
  });

  it('counts the layers of any mode in the same oven and ignores negative layers', () => {
    const r = bakeLayers(EMPTY, -5, DAY1, false);
    expect(r.xp).toBe(0);
    expect(r.oven.used).toBe(0);
  });

  it('never pays less than the plain rate and never loses a layer over many runs', () => {
    let oven = EMPTY;
    let xp = 0;
    let layers = 0;
    for (let i = 0; i < 200; i += 1) {
      const run = 7 + (i % 5);
      layers += run;
      const r = bakeLayers(oven, run, DAY1, false);
      xp += r.xp;
      oven = r.oven;
    }
    const fresh = Math.min(layers, OVEN.freshLayers);
    expect(xp * OVEN.layersPerXp + oven.carry).toBe(fresh * OVEN.layersPerXp + (layers - fresh));
  });
});

describe('freshLeft', () => {
  it('shows the whole oven on a new day and what is left on the same day', () => {
    const used: OvenState = { day: DAY1, used: 300, carry: 2 };
    expect(freshLeft(used, DAY1, false)).toBe(OVEN.freshLayers - 300);
    expect(freshLeft(used, DAY2, false)).toBe(OVEN.freshLayers);
    expect(freshLeft(used, DAY2, true)).toBe(OVEN.freshLayers - 300);
    expect(freshLeft(EMPTY, DAY1, false)).toBe(OVEN.freshLayers);
  });
});

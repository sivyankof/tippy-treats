import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import {
  coinCovered,
  comboCoinAmount,
  crumbCoinAmount,
  floatingCoinAmount,
  heightBonusCoins,
  multipliedCoins,
  rollFloatingCoin,
} from './coins';
import { Rng } from './rng';

const NONE = { coinMultAdd: 0 };
const DOUBLE = { coinMultAdd: 1 };
const TRIPLE = { coinMultAdd: 2 };

describe('coin amounts', () => {
  it('adds multipliers: x2 and x2 make x3', () => {
    expect(multipliedCoins(1, NONE)).toBe(1);
    expect(multipliedCoins(1, DOUBLE)).toBe(2);
    expect(multipliedCoins(1, TRIPLE)).toBe(3);
    expect(floatingCoinAmount(DOUBLE)).toBe(2);
  });

  it('pays combo coins from the fifth perfect in a row', () => {
    expect([1, 4].map((c) => comboCoinAmount(c, NONE))).toEqual([0, 0]);
    expect(comboCoinAmount(5, NONE)).toBe(1);
    expect(comboCoinAmount(30, NONE)).toBe(1);
    expect(comboCoinAmount(5, DOUBLE)).toBe(2);
  });

  it('turns the cut edge into whole coins and ignores it without crumb', () => {
    expect(crumbCoinAmount(100, null)).toBe(0);
    expect(crumbCoinAmount(100, 40)).toBe(2);
    expect(crumbCoinAmount(39.9, 40)).toBe(0);
    expect(crumbCoinAmount(0, 18)).toBe(0);
  });

  it('gives 2 coins per 10 layers at run end', () => {
    expect([0, 9, 10, 19, 25, 100].map(heightBonusCoins)).toEqual([0, 0, 2, 2, 4, 20]);
  });
});

describe('coinCovered', () => {
  it('includes the edges of the layer', () => {
    expect(coinCovered(540, 540, 100)).toBe(true);
    expect(coinCovered(590, 540, 100)).toBe(true);
    expect(coinCovered(490, 540, 100)).toBe(true);
    expect(coinCovered(590.5, 540, 100)).toBe(false);
    expect(coinCovered(400, 540, 100)).toBe(false);
  });
});

describe('rollFloatingCoin', () => {
  it('never spawns before the first coin layer and does not draw then', () => {
    const rng = new Rng(1);
    const before = rng.next();
    const fresh = new Rng(1);
    for (let i = 1; i < BALANCE.coins.fromLayer; i++)
      expect(rollFloatingCoin(fresh, i, 540)).toBeNull();
    expect(fresh.next()).toBe(before);
  });

  it('spawns about 35% of the time within the allowed offset', () => {
    const rng = new Rng(42);
    const xs: number[] = [];
    const total = 4000;
    for (let i = 0; i < total; i++) {
      const x = rollFloatingCoin(rng, BALANCE.coins.fromLayer, 400);
      if (x !== null) xs.push(x);
    }
    expect(xs.length / total).toBeGreaterThan(0.31);
    expect(xs.length / total).toBeLessThan(0.39);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(400 - BALANCE.coins.maxOffset);
    expect(Math.max(...xs)).toBeLessThan(400 + BALANCE.coins.maxOffset);
    expect(Math.min(...xs)).toBeLessThan(400 - 200);
    expect(Math.max(...xs)).toBeGreaterThan(400 + 200);
  });
});

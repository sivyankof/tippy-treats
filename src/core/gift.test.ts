import { describe, expect, it } from 'vitest';
import { GIFT } from '../data/gift';
import { giftReady, msUntilGift, openGift } from './gift';

describe('giftReady', () => {
  it('is ready at once for a new player', () => {
    expect(giftReady({ nextAt: 0 }, 1000, false)).toBe(true);
  });
  it('is ready exactly at nextAt and after', () => {
    expect(giftReady({ nextAt: 5000 }, 5000, false)).toBe(true);
    expect(giftReady({ nextAt: 5000 }, 9000, false)).toBe(true);
  });
  it('is not ready before nextAt', () => {
    expect(giftReady({ nextAt: 5000 }, 4999, false)).toBe(false);
  });
  it('is not ready when the clock went back', () => {
    expect(giftReady({ nextAt: 5000 }, 9000, true)).toBe(false);
  });
});

describe('openGift', () => {
  it('returns null when not ready', () => {
    expect(openGift({ nextAt: 5000 }, 4000, 'a')).toBeNull();
  });
  it('returns null when the clock went back', () => {
    expect(openGift({ nextAt: 0 }, 4000, 'a', true)).toBeNull();
  });
  it('schedules the next box one interval after now', () => {
    const now = 1_700_000_000_000;
    const result = openGift({ nextAt: 0 }, now, 'a');
    expect(result?.gift.nextAt).toBe(now + GIFT.intervalMs);
  });
  it('does not mutate the input', () => {
    const gift = { nextAt: 0 };
    openGift(gift, 100, 'a');
    expect(gift).toEqual({ nextAt: 0 });
  });
  it('gives the same amount for the same install and nextAt', () => {
    const a = openGift({ nextAt: 777 }, 1000, 'install-1');
    const b = openGift({ nextAt: 777 }, 99999, 'install-1');
    expect(a?.coins).toBe(b?.coins);
  });
  it('keeps every amount within range and covers both ends', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const coins = openGift({ nextAt: i }, i, `id-${i}`)?.coins ?? -1;
      expect(coins).toBeGreaterThanOrEqual(GIFT.minCoins);
      expect(coins).toBeLessThanOrEqual(GIFT.maxCoins);
      expect(Number.isInteger(coins)).toBe(true);
      seen.add(coins);
    }
    expect(seen.has(GIFT.minCoins)).toBe(true);
    expect(seen.has(GIFT.maxCoins)).toBe(true);
  });
});

describe('msUntilGift', () => {
  it('counts down to nextAt', () => {
    expect(msUntilGift({ nextAt: 5000 }, 2000)).toBe(3000);
  });
  it('is 0 when ready or new', () => {
    expect(msUntilGift({ nextAt: 5000 }, 5000)).toBe(0);
    expect(msUntilGift({ nextAt: 0 }, 5000)).toBe(0);
  });
});

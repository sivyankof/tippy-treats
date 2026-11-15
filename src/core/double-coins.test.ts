import { describe, expect, it } from 'vitest';
import { REWARDED_OFFERS } from '../data/rewarded-video';
import { addUsed, isNewDay, usedToday } from './day-count';
import { doublesLeft, withDoubleUsed } from './double-coins';

const DAY1 = '2026-11-10';
const DAY2 = '2026-11-11';

describe('day count', () => {
  it('starts over only on a strictly later day without a set-back clock', () => {
    expect(isNewDay('', DAY1, false)).toBe(true);
    expect(isNewDay(DAY1, DAY1, false)).toBe(false);
    expect(isNewDay(DAY2, DAY1, false)).toBe(false);
    expect(isNewDay(DAY1, DAY2, false)).toBe(true);
    expect(isNewDay(DAY1, DAY2, true)).toBe(false);
  });

  it('counts per day', () => {
    const c = addUsed({ day: '', used: 0 }, 2, DAY1, false);
    expect(c).toEqual({ day: DAY1, used: 2 });
    expect(usedToday(c, DAY1, false)).toBe(2);
    expect(usedToday(c, DAY2, false)).toBe(0);
    expect(addUsed(c, 1, DAY2, false)).toEqual({ day: DAY2, used: 1 });
  });
});

describe('x2 coins per day', () => {
  it('allows the daily limit and then none', () => {
    let doubles = { day: '', used: 0 };
    expect(doublesLeft(doubles, DAY1, false)).toBe(REWARDED_OFFERS.doubleCoinsPerDay);
    for (let i = 0; i < REWARDED_OFFERS.doubleCoinsPerDay; i += 1) {
      doubles = withDoubleUsed(doubles, DAY1, false);
    }
    expect(doublesLeft(doubles, DAY1, false)).toBe(0);
    expect(doublesLeft(doubles, DAY2, false)).toBe(REWARDED_OFFERS.doubleCoinsPerDay);
  });

  it('is not refilled by a clock set back', () => {
    const spent = { day: DAY2, used: REWARDED_OFFERS.doubleCoinsPerDay };
    expect(doublesLeft(spent, DAY1, false)).toBe(0);
    expect(doublesLeft(spent, DAY2, true)).toBe(0);
  });
});

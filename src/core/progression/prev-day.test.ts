import { describe, expect, it } from 'vitest';
import { previousDayBest, withDayBest, type DayBest } from './prev-day';

const none: DayBest = { day: '', bestHeight: 0 };
const days = (today: DayBest, prevDay: DayBest = none) => ({ today, prevDay });

describe('withDayBest', () => {
  it('starts today on the first Classic run ever, with no earlier day', () => {
    expect(withDayBest(days(none), '2026-11-27', 12)).toEqual({
      today: { day: '2026-11-27', bestHeight: 12 },
      prevDay: none,
    });
  });

  it('keeps the best of the same day and leaves the earlier day alone', () => {
    const before = days(
      { day: '2026-11-27', bestHeight: 30 },
      { day: '2026-11-25', bestHeight: 8 },
    );
    expect(withDayBest(before, '2026-11-27', 20)).toEqual(before);
    expect(withDayBest(before, '2026-11-27', 41).today.bestHeight).toBe(41);
  });

  it('moves today to the earlier day when a run comes on a later day', () => {
    const before = days(
      { day: '2026-11-25', bestHeight: 34 },
      { day: '2026-11-20', bestHeight: 9 },
    );
    expect(withDayBest(before, '2026-11-27', 10)).toEqual({
      today: { day: '2026-11-27', bestHeight: 10 },
      prevDay: { day: '2026-11-25', bestHeight: 34 },
    });
  });

  it('does not move anything when the clock went back a day', () => {
    const before = days(
      { day: '2026-11-27', bestHeight: 34 },
      { day: '2026-11-26', bestHeight: 9 },
    );
    const next = withDayBest(before, '2026-11-26', 5);
    expect(next.prevDay).toEqual({ day: '2026-11-26', bestHeight: 9 });
    expect(next.today).toEqual({ day: '2026-11-26', bestHeight: 5 });
  });

  it('does not change the save it was given', () => {
    const today = { day: '2026-11-25', bestHeight: 34 };
    const before = days(today);
    const next = withDayBest(before, '2026-11-26', 3);
    next.prevDay.bestHeight = 99;
    expect(today.bestHeight).toBe(34);
  });
});

describe('previousDayBest', () => {
  it('is today while no Classic run was recorded on the local day yet', () => {
    const save = days({ day: '2026-11-26', bestHeight: 34 }, { day: '2026-11-20', bestHeight: 9 });
    expect(previousDayBest(save, '2026-11-27')).toEqual({ day: '2026-11-26', bestHeight: 34 });
  });

  it('is the earlier day once today has a run', () => {
    const save = days({ day: '2026-11-27', bestHeight: 12 }, { day: '2026-11-24', bestHeight: 50 });
    expect(previousDayBest(save, '2026-11-27')).toEqual({ day: '2026-11-24', bestHeight: 50 });
  });

  it('is none for a new player', () => {
    expect(previousDayBest(days(none), '2026-11-27')).toEqual(none);
  });

  it('is the earlier day when the clock is behind today', () => {
    const save = days({ day: '2026-11-27', bestHeight: 12 }, { day: '2026-11-24', bestHeight: 50 });
    expect(previousDayBest(save, '2026-11-26')).toEqual({ day: '2026-11-24', bestHeight: 50 });
  });

  it('follows a run of a new day through withDayBest', () => {
    let save = days({ day: '2026-11-26', bestHeight: 34 });
    expect(previousDayBest(save, '2026-11-27').bestHeight).toBe(34);
    save = withDayBest(save, '2026-11-27', 20);
    expect(previousDayBest(save, '2026-11-27').bestHeight).toBe(34);
  });
});

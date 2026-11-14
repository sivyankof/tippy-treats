import { describe, expect, it } from 'vitest';
import { CLOCK_BACK_TOLERANCE_MS, MS_PER_DAY } from '../data/clock';
import {
  applyDayOffset,
  clockWentBack,
  daysBetween,
  localDay,
  msUntilLocalMidnight,
  now,
  utcDay,
} from './clock';

describe('applyDayOffset', () => {
  it('shifts by whole days in both directions', () => {
    expect(applyDayOffset(1000, 2)).toBe(1000 + 2 * MS_PER_DAY);
    expect(applyDayOffset(5 * MS_PER_DAY, -1)).toBe(4 * MS_PER_DAY);
    expect(applyDayOffset(1000, 0)).toBe(1000);
  });
});

describe('now', () => {
  it('is the system time without a window', () => {
    const before = Date.now();
    const value = now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value - before).toBeLessThan(1000);
  });
});

describe('day keys', () => {
  it('formats the UTC day', () => {
    expect(utcDay(Date.UTC(2026, 10, 14, 23, 59))).toBe('2026-11-14');
    expect(utcDay(Date.UTC(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('formats the local day with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05');
    expect(localDay(new Date(2026, 10, 14, 23, 59).getTime())).toBe('2026-11-14');
    expect(localDay(new Date(2026, 10, 15, 0, 0).getTime())).toBe('2026-11-15');
  });
});

describe('clockWentBack', () => {
  const last = 10 * MS_PER_DAY;

  it('is false for time moving forward or standing still', () => {
    expect(clockWentBack(last + 1, last)).toBe(false);
    expect(clockWentBack(last, last)).toBe(false);
  });

  it('tolerates a small step back', () => {
    expect(clockWentBack(last - CLOCK_BACK_TOLERANCE_MS, last)).toBe(false);
  });

  it('flags a step back beyond the tolerance', () => {
    expect(clockWentBack(last - CLOCK_BACK_TOLERANCE_MS - 1, last)).toBe(true);
    expect(clockWentBack(last - MS_PER_DAY, last)).toBe(true);
  });

  it('accepts a custom tolerance', () => {
    expect(clockWentBack(last - 5, last, 4)).toBe(true);
    expect(clockWentBack(last - 5, last, 5)).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts days forward, backward and zero', () => {
    expect(daysBetween('2026-11-14', '2026-11-14')).toBe(0);
    expect(daysBetween('2026-11-14', '2026-11-15')).toBe(1);
    expect(daysBetween('2026-11-14', '2026-11-12')).toBe(-2);
  });

  it('crosses month and year boundaries', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('knows leap years', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });

  it('is not shifted by daylight saving', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('is NaN for an empty or malformed day', () => {
    expect(daysBetween('', '2026-11-14')).toBeNaN();
    expect(daysBetween('2026-11-14', '')).toBeNaN();
    expect(daysBetween('14.11.2026', '2026-11-15')).toBeNaN();
  });
});

describe('msUntilLocalMidnight', () => {
  it('counts down to the next local midnight', () => {
    const noon = new Date(2026, 5, 10, 12, 0, 0).getTime();
    expect(msUntilLocalMidnight(noon)).toBe(12 * 3600 * 1000);
    const late = new Date(2026, 5, 10, 23, 59, 59).getTime();
    expect(msUntilLocalMidnight(late)).toBe(1000);
  });
});

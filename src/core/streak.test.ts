import { describe, expect, it } from 'vitest';
import { STREAK, STREAK_REWARDS } from '../data/streak';
import {
  calendarCells,
  claimStreak,
  countRunDay,
  declineStreak,
  restoreStreak,
  streakEntry,
  streakPosition,
  streakReward,
  type StreakState,
} from './streak';

const fresh: StreakState = { count: 0, best: 0, lastDay: '', cycle: 0, claimedDay: '' };
const make = (over: Partial<StreakState>): StreakState => ({ ...fresh, ...over });
const DAY = '2026-11-14';

describe('streakReward', () => {
  it('follows the table', () => {
    expect(streakReward(1, 0)).toEqual({ kind: 'coins', amount: 50 });
    expect(streakReward(2, 0)).toEqual({ kind: 'coins', amount: 75 });
    expect(streakReward(3, 5)).toEqual({ kind: 'berries', amount: 5 });
    expect(streakReward(4, 0)).toEqual({ kind: 'coins', amount: 125 });
    expect(streakReward(5, 0)).toEqual({ kind: 'berries', amount: 10 });
    expect(streakReward(6, 0)).toEqual({ kind: 'coins', amount: 200 });
  });

  it('gives the brownie on day 7 only in the first cycle', () => {
    expect(streakReward(7, 0)).toEqual({ kind: 'creature', id: 'brownie' });
    expect(streakReward(7, 1)).toEqual({ kind: 'berries', amount: 25 });
    expect(streakReward(7, 4)).toEqual({ kind: 'berries', amount: 25 });
  });
});

describe('streakPosition', () => {
  it('starts a new player at 1', () => {
    expect(streakPosition(fresh, DAY)).toBe(1);
  });
  it('continues after yesterday and stays on a run day', () => {
    expect(streakPosition(make({ count: 3, lastDay: '2026-11-13' }), DAY)).toBe(4);
    expect(streakPosition(make({ count: 3, lastDay: DAY }), DAY)).toBe(3);
  });
  it('restarts after a gap or a clock set back', () => {
    expect(streakPosition(make({ count: 3, lastDay: '2026-11-10' }), DAY)).toBe(1);
    expect(streakPosition(make({ count: 3, lastDay: '2026-11-20' }), DAY)).toBe(1);
  });
  it('wraps every 7 days', () => {
    expect(streakPosition(make({ count: 7, lastDay: '2026-11-13' }), DAY)).toBe(1);
    expect(streakPosition(make({ count: 7, lastDay: DAY }), DAY)).toBe(7);
    expect(streakPosition(make({ count: 15, lastDay: '2026-11-13' }), DAY)).toBe(2);
  });
  it('crosses month and year boundaries', () => {
    expect(streakPosition(make({ count: 2, lastDay: '2026-12-31' }), '2027-01-01')).toBe(3);
    expect(streakPosition(make({ count: 2, lastDay: '2028-02-29' }), '2028-03-01')).toBe(3);
  });
});

describe('streakEntry', () => {
  it('is none when the clock went back', () => {
    expect(streakEntry(fresh, DAY, true)).toEqual({ kind: 'none' });
  });
  it('is none once today is claimed', () => {
    expect(streakEntry(make({ claimedDay: DAY }), DAY, false)).toEqual({ kind: 'none' });
  });
  it('offers day 1 to a new player', () => {
    expect(streakEntry(fresh, DAY, false)).toEqual({
      kind: 'claim',
      position: 1,
      reward: STREAK_REWARDS[0],
    });
  });
  it('offers the next day after yesterday', () => {
    const s = make({ count: 2, lastDay: '2026-11-13', claimedDay: '2026-11-13' });
    expect(streakEntry(s, DAY, false)).toEqual({
      kind: 'claim',
      position: 3,
      reward: STREAK_REWARDS[2],
    });
  });
  it('offers the claim again on a run day when it was not claimed', () => {
    expect(streakEntry(make({ count: 2, lastDay: DAY }), DAY, false)).toMatchObject({
      kind: 'claim',
      position: 2,
    });
  });
  it('threatens after exactly one missed day', () => {
    expect(streakEntry(make({ count: 4, lastDay: '2026-11-12' }), DAY, false)).toEqual({
      kind: 'threat',
    });
    expect(streakEntry(make({ count: 4, lastDay: '2026-02-27' }), '2026-03-01', false)).toEqual({
      kind: 'threat',
    });
  });
  it('does not threaten with a zero streak', () => {
    const s = make({ count: 0, lastDay: '2026-11-12' });
    expect(streakEntry(s, DAY, false)).toMatchObject({ kind: 'claim', position: 1 });
  });
  it('starts over after several missed days', () => {
    const s = make({ count: 4, lastDay: '2026-11-10' });
    expect(streakEntry(s, DAY, false)).toMatchObject({ kind: 'claim', position: 1 });
  });
});

describe('claimStreak', () => {
  it('marks the day claimed and returns the reward', () => {
    const s = make({ count: 1, lastDay: '2026-11-13' });
    const result = claimStreak(s, DAY, false);
    expect(result?.reward).toEqual(STREAK_REWARDS[1]);
    expect(result?.position).toBe(2);
    expect(result?.streak.claimedDay).toBe(DAY);
    expect(result?.streak.cycle).toBe(0);
    expect(s.claimedDay).toBe('');
  });
  it('is null when there is nothing to claim', () => {
    expect(claimStreak(make({ claimedDay: DAY }), DAY, false)).toBeNull();
    expect(claimStreak(make({ count: 4, lastDay: '2026-11-12' }), DAY, false)).toBeNull();
  });
  it('day 7 pays the brownie and ends the first cycle', () => {
    const result = claimStreak(make({ count: 6, lastDay: '2026-11-13' }), DAY, false);
    expect(result?.reward).toEqual({ kind: 'creature', id: 'brownie' });
    expect(result?.streak.cycle).toBe(1);
  });
  it('day 7 of a later cycle pays berries', () => {
    const result = claimStreak(make({ count: 13, lastDay: '2026-11-13', cycle: 1 }), DAY, false);
    expect(result?.reward).toEqual({ kind: 'berries', amount: 25 });
    expect(result?.streak.cycle).toBe(2);
  });
});

describe('restoreStreak', () => {
  it('forgives the missed day so the streak continues', () => {
    const restored = restoreStreak(make({ count: 4, best: 6, lastDay: '2026-11-12' }), DAY, false);
    if (!restored) throw new Error('expected a restored streak');
    expect(restored.lastDay).toBe('2026-11-13');
    expect(restored.count).toBe(4);
    expect(streakEntry(restored, DAY, false)).toMatchObject({ kind: 'claim', position: 5 });
    expect(countRunDay(restored, DAY, false).count).toBe(5);
  });
  it('handles month and year boundaries', () => {
    const newYear = restoreStreak(make({ count: 1, lastDay: '2026-12-30' }), '2027-01-01', false);
    expect(newYear?.lastDay).toBe('2026-12-31');
    const march = restoreStreak(make({ count: 1, lastDay: '2026-02-27' }), '2026-03-01', false);
    expect(march?.lastDay).toBe('2026-02-28');
  });
  it('refuses outside the threat window', () => {
    expect(restoreStreak(make({ count: 4, lastDay: '2026-11-10' }), DAY, false)).toBeNull();
    expect(restoreStreak(make({ count: 0, lastDay: '2026-11-12' }), DAY, false)).toBeNull();
    expect(restoreStreak(make({ count: 4, lastDay: '2026-11-13' }), DAY, false)).toBeNull();
    expect(restoreStreak(make({ count: 4, lastDay: DAY }), DAY, false)).toBeNull();
    expect(restoreStreak(fresh, DAY, false)).toBeNull();
  });
  it('refuses with the clock set back', () => {
    expect(restoreStreak(make({ count: 4, lastDay: '2026-11-12' }), DAY, true)).toBeNull();
  });
  it('costs 20 berries', () => {
    expect(STREAK.restoreBerries).toBe(20);
  });
});

describe('declineStreak', () => {
  it('zeroes the count, keeps the best, and the claim is day 1', () => {
    const declined = declineStreak(make({ count: 4, best: 9, lastDay: '2026-11-12' }), DAY);
    expect(declined).toMatchObject({ count: 0, best: 9 });
    expect(streakEntry(declined, DAY, false)).toMatchObject({ kind: 'claim', position: 1 });
    expect(countRunDay(declined, DAY, false).count).toBe(1);
  });
  it('changes nothing outside the threat window', () => {
    const s = make({ count: 4, best: 9, lastDay: '2026-11-13' });
    expect(declineStreak(s, DAY)).toBe(s);
  });
});

describe('clock set back across midnight', () => {
  const NEXT = '2026-11-15';
  it('offers nothing when claimedDay is later than today', () => {
    expect(streakEntry(make({ count: 3, lastDay: DAY, claimedDay: NEXT }), DAY, false)).toEqual({
      kind: 'none',
    });
    const both = make({ count: 3, lastDay: NEXT, claimedDay: NEXT });
    expect(streakEntry(both, DAY, false)).toEqual({ kind: 'none' });
  });
  it('offers nothing when lastDay is later than today', () => {
    expect(streakEntry(make({ count: 3, lastDay: NEXT }), DAY, false)).toEqual({ kind: 'none' });
  });
  it('cannot pay twice by toggling the clock around midnight', () => {
    const day1 = claimStreak(make({ count: 2, lastDay: DAY }), DAY, false);
    expect(day1).not.toBeNull();
    if (!day1) return;
    const afterMidnight = claimStreak(countRunDay(day1.streak, NEXT, false), NEXT, false);
    expect(afterMidnight).not.toBeNull();
    if (!afterMidnight) return;
    // The clock goes back a few minutes across midnight and forward again.
    expect(claimStreak(afterMidnight.streak, DAY, false)).toBeNull();
    expect(claimStreak(afterMidnight.streak, NEXT, false)).toBeNull();
    expect(claimStreak(afterMidnight.streak, DAY, false)).toBeNull();
  });
  it('refuses a claim while the clock is back', () => {
    expect(claimStreak(make({ count: 1, lastDay: '2026-11-13' }), DAY, true)).toBeNull();
  });
  it('countRunDay keeps the streak when lastDay is later than today', () => {
    const s = make({ count: 3, best: 3, lastDay: NEXT });
    expect(countRunDay(s, DAY, false)).toBe(s);
  });
});

describe('countRunDay', () => {
  it('starts a new player at 1', () => {
    expect(countRunDay(fresh, DAY, false)).toMatchObject({ count: 1, best: 1, lastDay: DAY });
  });
  it('grows on the next day', () => {
    const s = make({ count: 3, best: 3, lastDay: '2026-11-13' });
    expect(countRunDay(s, DAY, false)).toMatchObject({ count: 4, best: 4 });
  });
  it('does not change on the same day or with the clock set back', () => {
    const s = make({ count: 3, best: 5, lastDay: DAY });
    expect(countRunDay(s, DAY, false)).toBe(s);
    expect(countRunDay(make({ count: 3, lastDay: '2026-11-13' }), DAY, true).count).toBe(3);
  });
  it('restarts at 1 after missed days, keeping the best', () => {
    const s = make({ count: 3, best: 8, lastDay: '2026-11-10' });
    expect(countRunDay(s, DAY, false)).toMatchObject({ count: 1, best: 8 });
  });
  it('grows across month and year boundaries', () => {
    expect(countRunDay(make({ count: 2, lastDay: '2026-12-31' }), '2027-01-01', false).count).toBe(
      3,
    );
    expect(countRunDay(make({ count: 2, lastDay: '2028-02-29' }), '2028-03-01', false).count).toBe(
      3,
    );
  });
  it('does not mutate its input', () => {
    const s = make({ count: 1, lastDay: '2026-11-13' });
    countRunDay(s, DAY, false);
    expect(s.count).toBe(1);
  });
});

describe('calendarCells', () => {
  it('gives 7 cells with done, today and future states', () => {
    const cells = calendarCells(make({ count: 2, lastDay: '2026-11-13' }), DAY);
    expect(cells.map((c) => c.state)).toEqual([
      'done',
      'done',
      'today',
      'future',
      'future',
      'future',
      'future',
    ]);
    expect(cells[6]?.reward).toEqual({ kind: 'creature', id: 'brownie' });
  });
  it('marks today done once claimed', () => {
    const s = make({ count: 2, lastDay: '2026-11-13', claimedDay: DAY });
    expect(calendarCells(s, DAY).map((c) => c.state)).toEqual([
      'done',
      'done',
      'done',
      'future',
      'future',
      'future',
      'future',
    ]);
  });
  it('shows a new player at day 1 today', () => {
    expect(calendarCells(fresh, DAY)[0]?.state).toBe('today');
  });
  it('shows berries on day 7 after the first cycle', () => {
    const cells = calendarCells(make({ count: 7, lastDay: DAY, cycle: 1 }), DAY);
    expect(cells[6]?.reward).toEqual({ kind: 'berries', amount: 25 });
  });
  it('keeps the paid reward on a claimed day 7', () => {
    const s = make({ count: 7, lastDay: DAY, cycle: 1, claimedDay: DAY });
    expect(calendarCells(s, DAY)[6]).toMatchObject({
      state: 'done',
      reward: { kind: 'creature', id: 'brownie' },
    });
  });
});

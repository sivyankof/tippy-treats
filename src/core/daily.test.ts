import { describe, expect, it } from 'vitest';
import { CREATURE_IDS } from '../data/creatures';
import { MS_PER_DAY } from '../data/clock';
import { DAILY } from '../data/daily';
import { LEVEL_REWARDS } from '../data/progression';
import {
  addAttempt,
  attemptsLeft,
  canAddAttempt,
  dailyForDay,
  dailySeed,
  dailyTeam,
  dailyUnlocked,
  msUntilNextUtcDay,
  recordDailyRun,
  startAttempt,
  type DailyState,
} from './daily';

const baseFresh = (): DailyState => ({
  day: '',
  attemptsUsed: 0,
  extraAttemptUsed: false,
  best: 0,
  claimedTiers: [],
});

const fresh = baseFresh;

const played: DailyState = {
  day: '2026-11-14',
  attemptsUsed: 2,
  extraAttemptUsed: true,
  best: 40,
  claimedTiers: [15, 30],
};

const dayOf = (month: string, d: number): string => `2026-${month}-${String(d).padStart(2, '0')}`;

describe('dailySeed', () => {
  it('turns the date into YYYYMMDD', () => {
    expect(dailySeed('2026-11-14')).toBe(20261114);
    expect(dailySeed('2027-01-01')).toBe(20270101);
  });
  it('gives 0 for a malformed day', () => {
    expect(dailySeed('')).toBe(0);
    expect(dailySeed('2026-1-4')).toBe(0);
  });
});

describe('dailyTeam', () => {
  it('has three distinct creatures at the daily level', () => {
    for (const day of ['2026-11-14', '2026-12-31', '2027-01-01', '2028-02-29']) {
      const team = dailyTeam(day);
      expect(team).toHaveLength(DAILY.teamSize);
      expect(new Set(team.map((slot) => slot.id)).size).toBe(DAILY.teamSize);
      for (const slot of team) {
        expect(CREATURE_IDS).toContain(slot.id);
        expect(slot.level).toBe(DAILY.teamLevel);
      }
    }
  });
  it('is the same for the same day and changes across days', () => {
    expect(dailyTeam('2026-11-14')).toEqual(dailyTeam('2026-11-14'));
    const keys = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      keys.add(
        dailyTeam(dayOf('02', d))
          .map((s) => s.id)
          .join(),
      );
    }
    expect(keys.size).toBeGreaterThan(10);
  });
  it('reaches every creature over a month of days', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      for (const slot of dailyTeam(dayOf('03', d))) seen.add(slot.id);
    }
    expect(seen.size).toBe(CREATURE_IDS.length);
  });
});

describe('dailyUnlocked', () => {
  it('opens at the level of the dailyTower reward', () => {
    const level = Number(Object.entries(LEVEL_REWARDS).find(([, r]) => r.dailyTower)?.[0]);
    expect(level).toBe(5);
    expect(dailyUnlocked(level - 1)).toBe(false);
    expect(dailyUnlocked(level)).toBe(true);
    expect(dailyUnlocked(level + 10)).toBe(true);
    expect(dailyUnlocked(1)).toBe(false);
  });
});

describe('dailyForDay', () => {
  it('resets everything for a new day', () => {
    expect(dailyForDay(played, '2026-11-15')).toEqual({
      day: '2026-11-15',
      attemptsUsed: 0,
      extraAttemptUsed: false,
      best: 0,
      claimedTiers: [],
    });
  });
  it('starts a new player on the first day', () => {
    expect(dailyForDay(fresh(), '2026-11-14')).toEqual({ ...fresh(), day: '2026-11-14' });
  });
  it('keeps the same day, as a copy', () => {
    const same = dailyForDay(played, '2026-11-14');
    expect(same).toEqual(played);
    expect(same).not.toBe(played);
    expect(same.claimedTiers).not.toBe(played.claimedTiers);
  });
  it('keeps the slice when the clock went back', () => {
    expect(dailyForDay(played, '2026-11-13')).toEqual(played);
  });
  it('ignores an empty day', () => {
    expect(dailyForDay(played, '')).toEqual(played);
  });
  it('resets after several missed days', () => {
    expect(dailyForDay(played, '2026-12-20').best).toBe(0);
  });
  it('resets across month and year boundaries', () => {
    expect(dailyForDay({ ...played, day: '2026-11-30' }, '2026-12-01').best).toBe(0);
    expect(dailyForDay({ ...played, day: '2026-12-31' }, '2027-01-01').attemptsUsed).toBe(0);
  });
});

describe('attempts', () => {
  it('gives the free attempts to a fresh day', () => {
    expect(attemptsLeft(fresh())).toBe(DAILY.attempts);
  });
  it('counts attempts down and stops at zero', () => {
    let state = fresh();
    for (let i = 0; i < DAILY.attempts; i++) {
      expect(attemptsLeft(state)).toBe(DAILY.attempts - i);
      const next = startAttempt(state);
      expect(next).not.toBeNull();
      state = next ?? state;
    }
    expect(attemptsLeft(state)).toBe(0);
    expect(startAttempt(state)).toBeNull();
  });
  it('adds one extra attempt once a day', () => {
    const spent = { ...fresh(), attemptsUsed: DAILY.attempts };
    expect(canAddAttempt(spent)).toBe(true);
    const more = addAttempt(spent);
    expect(more.extraAttemptUsed).toBe(true);
    expect(attemptsLeft(more)).toBe(DAILY.extraAttempts);
    expect(canAddAttempt(more)).toBe(false);
    expect(addAttempt(more)).toEqual(more);
    expect(attemptsLeft(addAttempt(more))).toBe(DAILY.extraAttempts);
  });
  it('lets the extra attempt be played', () => {
    const more = addAttempt({ ...fresh(), attemptsUsed: DAILY.attempts });
    const started = startAttempt(more);
    expect(started?.attemptsUsed).toBe(DAILY.attempts + 1);
    expect(started && startAttempt(started)).toBeNull();
  });
  it('never reports a negative count', () => {
    expect(attemptsLeft({ ...fresh(), attemptsUsed: 99 })).toBe(0);
  });
  it('does not mutate', () => {
    const state = fresh();
    startAttempt(state);
    addAttempt(state);
    expect(state).toEqual(fresh());
  });
});

describe('recordDailyRun', () => {
  const DAY = '2026-11-14';
  const fresh = (): DailyState => ({ ...baseFresh(), day: DAY });
  it('pays nothing below the first tier but keeps the best', () => {
    const { daily, paid } = recordDailyRun(fresh(), 14, DAY);
    expect(paid).toEqual([]);
    expect(daily.best).toBe(14);
    expect(daily.claimedTiers).toEqual([]);
  });
  it('pays the first tier exactly at its height', () => {
    const { daily, paid } = recordDailyRun(fresh(), 15, DAY);
    expect(paid).toEqual([{ height: 15, cost: { coins: 30 } }]);
    expect(daily.claimedTiers).toEqual([15]);
  });
  it('pays every skipped tier at once', () => {
    const { daily, paid } = recordDailyRun(fresh(), 80, DAY);
    expect(paid.map((p) => p.height)).toEqual([15, 30, 50, 75]);
    expect(paid[3]?.cost).toEqual({ coins: 150, berries: 5 });
    expect(daily.best).toBe(80);
  });
  it('pays the top tier at 100 and above', () => {
    const { paid } = recordDailyRun(
      { ...fresh(), best: 75, claimedTiers: [15, 30, 50, 75] },
      130,
      DAY,
    );
    expect(paid).toEqual([{ height: 100, cost: { berries: 15 } }]);
  });
  it('never pays a tier twice', () => {
    const first = recordDailyRun(fresh(), 40, DAY);
    const second = recordDailyRun(first.daily, 40, DAY);
    expect(second.paid).toEqual([]);
    const third = recordDailyRun(second.daily, 55, DAY);
    expect(third.paid.map((p) => p.height)).toEqual([50]);
    expect(third.daily.claimedTiers).toEqual([15, 30, 50]);
  });
  it('keeps the best when a run is worse', () => {
    const { daily, paid } = recordDailyRun(played, 10, DAY);
    expect(daily.best).toBe(40);
    expect(paid).toEqual([]);
  });
  it('handles a bad height as zero', () => {
    expect(recordDailyRun(fresh(), -5, DAY).daily.best).toBe(0);
    expect(recordDailyRun(fresh(), Number.NaN, DAY).daily.best).toBe(0);
    expect(recordDailyRun(fresh(), 15.9, DAY).daily.best).toBe(15);
  });
  it('does not mutate and does not share the paid cost with the data', () => {
    const state = fresh();
    const { paid } = recordDailyRun(state, 100, DAY);
    expect(state).toEqual(fresh());
    expect(paid[0]?.cost).not.toBe(DAILY.tiers[0]?.reward);
  });
  it('ignores a run that started on an earlier day and crossed midnight', () => {
    const next = dailyForDay({ ...played, day: '2026-11-14' }, '2026-11-15');
    const { daily, paid } = recordDailyRun(next, 120, '2026-11-14');
    expect(paid).toEqual([]);
    expect(daily).toEqual(next);
    expect(daily.best).toBe(0);
    expect(daily.claimedTiers).toEqual([]);
  });
  it('ignores a run of another day, including a new player with an empty day', () => {
    expect(recordDailyRun(fresh(), 50, '2026-11-13').paid).toEqual([]);
    expect(recordDailyRun(baseFresh(), 50, '2026-11-14').paid).toEqual([]);
  });
  it('matches the tier table of the docs', () => {
    expect(DAILY.tiers.map((t) => t.height)).toEqual([15, 30, 50, 75, 100]);
  });
});

describe('msUntilNextUtcDay', () => {
  it('counts to 00:00 UTC', () => {
    expect(msUntilNextUtcDay(Date.UTC(2026, 10, 14, 12, 0, 0))).toBe(MS_PER_DAY / 2);
    expect(msUntilNextUtcDay(Date.UTC(2026, 10, 14, 23, 59, 59, 999))).toBe(1);
  });
  it('gives a full day exactly at midnight', () => {
    expect(msUntilNextUtcDay(Date.UTC(2026, 10, 14))).toBe(MS_PER_DAY);
  });
  it('works across month and year boundaries and before 1970', () => {
    expect(msUntilNextUtcDay(Date.UTC(2026, 11, 31, 23, 0, 0))).toBe(3600000);
    expect(msUntilNextUtcDay(-1)).toBe(1);
  });
});

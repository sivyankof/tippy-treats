import { describe, expect, it } from 'vitest';
import { NOTIF } from '../../data/progression/notif';
import { CLOCK_BACK_TOLERANCE_MS } from '../../data/app/clock';
import { createDefaultSave } from '../save/defaults';
import type { Save } from '../save/schema';
import { buildNotifPlan, giftDayToStore, outOfQuietHours, type PlannedNotif } from './notif-plan';

const local = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime();

const HOUR = 3_600_000;

/** A save at `nowMs` with every condition off: nothing is planned until a test turns one on. */
function quietSave(nowMs: number): Save {
  const save = createDefaultSave(nowMs, 'test');
  return { ...save, lastSeenAt: nowMs };
}

function withStreak(save: Save, count: number, lastDay: string): Save {
  return { ...save, streak: { ...save.streak, count, best: count, lastDay } };
}

function withDailySeen(save: Save): Save {
  return { ...save, tutorial: { ...save.tutorial, hintsShown: ['dailyIntro'] } };
}

function withGift(save: Save, nextAt: number): Save {
  return { ...save, gift: { nextAt } };
}

function withSwitches(save: Save, patch: Partial<Save['settings']['notifications']>): Save {
  return {
    ...save,
    settings: { ...save.settings, notifications: { ...save.settings.notifications, ...patch } },
  };
}

function ids(plan: PlannedNotif[]): number[] {
  return plan.map((item) => item.id);
}

describe('outOfQuietHours', () => {
  it('keeps the allowed hours as they are', () => {
    expect(outOfQuietHours(local(11, 20, 9, 0))).toBe(local(11, 20, 9, 0));
    expect(outOfQuietHours(local(11, 20, 21, 59))).toBe(local(11, 20, 21, 59));
  });

  it('moves the evening quiet hours to 9:00 of the next day', () => {
    expect(outOfQuietHours(local(11, 20, 22, 0))).toBe(local(11, 21, 9, 0));
    expect(outOfQuietHours(local(11, 20, 23, 30))).toBe(local(11, 21, 9, 0));
  });

  it('moves the night after midnight to 9:00 of the same day', () => {
    expect(outOfQuietHours(local(11, 21, 0, 0))).toBe(local(11, 21, 9, 0));
    expect(outOfQuietHours(local(11, 21, 8, 59))).toBe(local(11, 21, 9, 0));
  });

  it('crosses a month end', () => {
    expect(outOfQuietHours(local(11, 30, 23, 0))).toBe(local(12, 1, 9, 0));
  });
});

describe('buildNotifPlan: empty cases', () => {
  it('plans nothing for a new player', () => {
    const now = local(11, 20, 12);
    const plan = buildNotifPlan(quietSave(now), now);
    // Only the two "come back" notifications are left.
    expect(ids(plan)).toEqual([NOTIF.ids.comeback3, NOTIF.ids.comeback7]);
  });

  it('plans nothing when every kind is switched off', () => {
    const now = local(11, 20, 12);
    let save = withStreak(withDailySeen(withGift(quietSave(now), now + 2 * HOUR)), 5, '2026-11-19');
    save = withSwitches(save, { gift: false, streak: false, daily: false, comeback: false });
    expect(buildNotifPlan(save, now)).toEqual([]);
  });

  it('plans nothing when the clock looks set back', () => {
    const now = local(11, 20, 12);
    const save = withDailySeen({
      ...quietSave(now),
      lastSeenAt: now + CLOCK_BACK_TOLERANCE_MS + 1,
    });
    expect(buildNotifPlan(save, now)).toEqual([]);
  });

  it('tolerates a small step back of the clock', () => {
    const now = local(11, 20, 12);
    const save = { ...quietSave(now), lastSeenAt: now + CLOCK_BACK_TOLERANCE_MS };
    expect(buildNotifPlan(save, now).length).toBeGreaterThan(0);
  });
});

describe('buildNotifPlan: gift', () => {
  const now = local(11, 20, 12);
  const only = { streak: false, daily: false, comeback: false };

  it('goes out when the box is ready, with stable id and text keys', () => {
    const save = withSwitches(withGift(quietSave(now), now + 4 * HOUR), only);
    const plan = buildNotifPlan(save, now);
    expect(plan).toEqual([
      {
        id: NOTIF.ids.gift,
        at: new Date(now + 4 * HOUR),
        titleKey: 'notif.gift.title',
        bodyKey: 'notif.gift.body',
      },
    ]);
  });

  it('is not planned when the box is ready already or never opened', () => {
    expect(buildNotifPlan(withSwitches(withGift(quietSave(now), now), only), now)).toEqual([]);
    expect(buildNotifPlan(withSwitches(withGift(quietSave(now), 0), only), now)).toEqual([]);
  });

  it('moves a night moment to 9:00', () => {
    const late = local(11, 20, 19);
    const save = withSwitches(withGift(quietSave(late), late + 4 * HOUR), only);
    expect(buildNotifPlan(save, late)[0]?.at.getTime()).toBe(local(11, 21, 9));
  });

  it('is skipped when the day of its moment already had one (giftDay)', () => {
    const base = withSwitches(withGift(quietSave(now), now + 4 * HOUR), only);
    const blocked = { ...base, notif: { giftDay: '2026-11-20' } };
    expect(buildNotifPlan(blocked, now)).toEqual([]);
    const yesterday = { ...base, notif: { giftDay: '2026-11-19' } };
    expect(buildNotifPlan(yesterday, now)).toHaveLength(1);
  });

  it('uses the day of the moved moment for the giftDay rule', () => {
    const late = local(11, 20, 19);
    const base = withSwitches(withGift(quietSave(late), late + 4 * HOUR), only);
    // The moment moves to the 21st: a gift of the 20th does not block it.
    expect(buildNotifPlan({ ...base, notif: { giftDay: '2026-11-20' } }, late)).toHaveLength(1);
    expect(buildNotifPlan({ ...base, notif: { giftDay: '2026-11-21' } }, late)).toEqual([]);
  });

  it('building the plan twice gives the same plan', () => {
    const save = withSwitches(withGift(quietSave(now), now + 4 * HOUR), only);
    expect(buildNotifPlan(save, now)).toEqual(buildNotifPlan(save, now));
  });
});

describe('buildNotifPlan: streak', () => {
  const only = { gift: false, daily: false, comeback: false };
  const morning = local(11, 20, 12);

  it('goes out today at 19:00 when yesterday was played and a streak of 2 is alive', () => {
    const save = withSwitches(withStreak(quietSave(morning), 2, '2026-11-19'), only);
    const plan = buildNotifPlan(save, morning);
    expect(ids(plan)).toEqual([NOTIF.ids.streak]);
    expect(plan[0]?.at.getTime()).toBe(local(11, 20, 19));
  });

  it('needs a streak of at least 2', () => {
    const save = withSwitches(withStreak(quietSave(morning), 1, '2026-11-19'), only);
    expect(buildNotifPlan(save, morning)).toEqual([]);
  });

  it('goes out tomorrow at 19:00 when a run was already played today', () => {
    const save = withSwitches(withStreak(quietSave(morning), 5, '2026-11-20'), only);
    const plan = buildNotifPlan(save, morning);
    expect(ids(plan)).toEqual([NOTIF.ids.streak]);
    expect(plan[0]?.at.getTime()).toBe(local(11, 21, 19));
  });

  it('goes out tomorrow at 19:00 when today was played and it is past 19:00', () => {
    const evening = local(11, 20, 20);
    const save = withSwitches(withStreak(quietSave(evening), 3, '2026-11-20'), only);
    expect(buildNotifPlan(save, evening)[0]?.at.getTime()).toBe(local(11, 21, 19));
  });

  it('needs a streak of at least 2 also after a run today', () => {
    const save = withSwitches(withStreak(quietSave(morning), 1, '2026-11-20'), only);
    expect(buildNotifPlan(save, morning)).toEqual([]);
  });

  it('is not planned for a broken streak (the last run was two days ago or more)', () => {
    const save = withSwitches(withStreak(quietSave(morning), 5, '2026-11-18'), only);
    expect(buildNotifPlan(save, morning)).toEqual([]);
  });

  it('is not planned after 19:00', () => {
    const evening = local(11, 20, 19, 30);
    const save = withSwitches(withStreak(quietSave(evening), 4, '2026-11-19'), only);
    expect(buildNotifPlan(save, evening)).toEqual([]);
  });

  it('keeps 19:00 local across the daylight-saving change', () => {
    // Late March and late October: the hour stays 19:00 on the wall clock.
    for (const [month, day] of [
      [3, 29],
      [10, 25],
      [11, 1],
    ]) {
      const now = local(month ?? 1, day ?? 1, 10);
      const yesterday = new Date(now - 24 * HOUR);
      const lastDay = `2026-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const save = withSwitches(withStreak(quietSave(now), 3, lastDay), only);
      expect(buildNotifPlan(save, now)[0]?.at.getHours()).toBe(NOTIF.streakHour);
    }
  });
});

describe('buildNotifPlan: daily tower', () => {
  const only = { gift: false, streak: false, comeback: false };
  const now = local(11, 20, 21);

  it('goes out at 10:00 the next day for a player who has seen the tower', () => {
    const plan = buildNotifPlan(withSwitches(withDailySeen(quietSave(now)), only), now);
    expect(ids(plan)).toEqual([NOTIF.ids.daily]);
    expect(plan[0]?.at.getTime()).toBe(local(11, 21, 10));
  });

  it('is not planned for a player who never saw it', () => {
    expect(buildNotifPlan(withSwitches(quietSave(now), only), now)).toEqual([]);
  });

  it('is off with its switch', () => {
    const save = withSwitches(withDailySeen(quietSave(now)), { ...only, daily: false });
    expect(buildNotifPlan(save, now)).toEqual([]);
  });
});

describe('buildNotifPlan: come back', () => {
  const only = { gift: false, streak: false, daily: false };

  it('plans 3 and 7 days ahead at the same time of day', () => {
    const now = local(11, 20, 15, 20);
    const plan = buildNotifPlan(withSwitches(quietSave(now), only), now);
    expect(plan.map((item) => item.at.getTime())).toEqual([
      local(11, 23, 15, 20),
      local(11, 27, 15, 20),
    ]);
    expect(plan.map((item) => item.bodyKey)).toEqual([
      'notif.comeback3.body',
      'notif.comeback7.body',
    ]);
  });

  it('moves a night moment to 9:00', () => {
    const now = local(11, 20, 23, 15);
    const plan = buildNotifPlan(withSwitches(quietSave(now), only), now);
    expect(plan.map((item) => item.at.getTime())).toEqual([local(11, 24, 9), local(11, 28, 9)]);
  });

  it('is off with its switch', () => {
    expect(
      buildNotifPlan(
        withSwitches(quietSave(local(11, 20, 12)), { ...only, comeback: false }),
        local(11, 20, 12),
      ),
    ).toEqual([]);
  });
});

describe('buildNotifPlan: the daily cap and the quiet hours', () => {
  it('allows two on one local day and the next one on the following day', () => {
    // Today: the streak at 19:00 and the gift at 15:00; tomorrow 10:00 the daily tower is fine.
    const now = local(11, 20, 11);
    let save = withStreak(
      withDailySeen(withGift(quietSave(now), local(11, 20, 15))),
      3,
      '2026-11-19',
    );
    save = withSwitches(save, { comeback: false });
    const plan = buildNotifPlan(save, now);
    expect(ids(plan)).toEqual([NOTIF.ids.gift, NOTIF.ids.streak, NOTIF.ids.daily]);
  });

  it('keeps two that land on the same morning after the night move', () => {
    const now = local(11, 20, 23, 30);
    const save = withSwitches(withGift(quietSave(now), local(11, 23, 23, 30)), {
      streak: false,
      daily: false,
    });
    const plan = buildNotifPlan(save, now);
    expect(plan.filter((item) => item.at.getTime() === local(11, 24, 9))).toHaveLength(2);
  });

  it('never holds three on one local day', () => {
    const now = local(11, 20, 23, 30);
    let save = withDailySeen(withGift(quietSave(now), now + 4 * HOUR));
    save = withStreak(save, 4, '2026-11-19');
    const plan = buildNotifPlan(save, now);
    const perDay = new Map<string, number>();
    for (const item of plan) {
      const key = item.at.toDateString();
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(NOTIF.maxPerDay);
  });

  it('never plans anything inside 22:00-9:00 and never in the past', () => {
    for (let hour = 0; hour < 24; hour++) {
      const now = local(11, 20, hour, 7);
      let save = withDailySeen(withGift(quietSave(now), now + 4 * HOUR));
      save = withStreak(save, 4, '2026-11-19');
      for (const item of buildNotifPlan(save, now)) {
        const h = item.at.getHours();
        expect(h >= NOTIF.quietToHour && h < NOTIF.quietFromHour).toBe(true);
        expect(item.at.getTime()).toBeGreaterThan(now);
      }
    }
  });

  it('sorts by time and gives each slot its own id', () => {
    const now = local(11, 20, 11);
    const save = withStreak(
      withDailySeen(withGift(quietSave(now), local(11, 20, 15))),
      3,
      '2026-11-19',
    );
    const plan = buildNotifPlan(save, now);
    const times = plan.map((item) => item.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(ids(plan)).size).toBe(plan.length);
  });
});

describe('giftDayToStore', () => {
  const now = local(11, 20, 18);

  it('is null while the moment is ahead, or the box was never opened', () => {
    expect(giftDayToStore(withGift(quietSave(now), now + HOUR), now)).toBeNull();
    expect(giftDayToStore(withGift(quietSave(now), 0), now)).toBeNull();
  });

  it('gives the day of a gift moment that has passed', () => {
    expect(giftDayToStore(withGift(quietSave(now), now - HOUR), now)).toBe('2026-11-20');
  });

  it('uses the moved moment: a night gift counts for the next morning', () => {
    const save = withGift(quietSave(now), local(11, 20, 23));
    expect(giftDayToStore(save, local(11, 20, 23, 30))).toBeNull();
    expect(giftDayToStore(save, local(11, 21, 9, 5))).toBe('2026-11-21');
  });

  it('is null when the day is stored already', () => {
    const save = { ...withGift(quietSave(now), now - HOUR), notif: { giftDay: '2026-11-20' } };
    expect(giftDayToStore(save, now)).toBeNull();
  });
});

import { NOTIF, NOTIF_KIND, NOTIF_PRIORITY, type NotifSlot } from '../../data/progression/notif';
import {
  addLocalDays,
  atLocalHour,
  clockWentBack,
  daysBetween,
  localDay,
  localHour,
} from '../../util/calendar';
import type { Save } from '../save/schema';

/** One local notification to schedule: when, and the i18n keys of its texts. */
export interface PlannedNotif {
  id: number;
  at: Date;
  titleKey: string;
  bodyKey: string;
}

/** The first allowed moment at or after `ms`: inside the quiet hours it is the next `quietToHour`. */
export function outOfQuietHours(ms: number): number {
  const hour = localHour(ms);
  if (hour >= NOTIF.quietFromHour) return atLocalHour(ms, 1, NOTIF.quietToHour);
  if (hour < NOTIF.quietToHour) return atLocalHour(ms, 0, NOTIF.quietToHour);
  return ms;
}

/** The moment of the "gift ready" notification of the box that opens at `nextAt`. */
function giftMoment(nextAt: number): number {
  return outOfQuietHours(nextAt);
}

/** When each slot would go out, or null when its own conditions say no (before the switches and the cap). */
function slotMoment(slot: NotifSlot, save: Save, nowMs: number): number | null {
  const today = localDay(nowMs);
  switch (slot) {
    case 'gift': {
      if (save.gift.nextAt <= nowMs) return null;
      const at = giftMoment(save.gift.nextAt);
      return localDay(at) === save.notif.giftDay ? null : at;
    }
    case 'streak': {
      // A streak that is alive: the last run was yesterday (remind today at 19:00 if still ahead)
      // or today (remind tomorrow at 19:00, the day is already extended).
      if (save.streak.count < NOTIF.streakMin) return null;
      const gap = daysBetween(save.streak.lastDay, today);
      if (gap === 0) return atLocalHour(nowMs, 1, NOTIF.streakHour);
      if (gap !== 1) return null;
      const at = atLocalHour(nowMs, 0, NOTIF.streakHour);
      return at > nowMs ? at : null;
    }
    case 'daily':
      return save.tutorial.hintsShown.includes('dailyIntro')
        ? atLocalHour(nowMs, 1, NOTIF.dailyHour)
        : null;
    case 'comeback3':
    case 'comeback7':
      return outOfQuietHours(addLocalDays(nowMs, NOTIF.comebackDays[slot]));
  }
}

const TEXT_KEY: Record<NotifSlot, string> = {
  gift: 'notif.gift',
  streak: 'notif.streak',
  daily: 'notif.daily',
  comeback3: 'notif.comeback3',
  comeback7: 'notif.comeback7',
};

/**
 * The notifications to schedule when the app goes to the background (docs/04-meta-retention.md,
 * section 7): the enabled kinds whose conditions hold, moved out of the quiet hours, at most
 * `maxPerDay` on one local day (the first by priority win). Nothing when the clock looks set back.
 * Pure: the time comes in as `nowMs`.
 */
export function buildNotifPlan(save: Save, nowMs: number): PlannedNotif[] {
  if (clockWentBack(nowMs, save.lastSeenAt)) return [];
  const perDay = new Map<string, number>();
  const plan: PlannedNotif[] = [];
  for (const slot of NOTIF_PRIORITY) {
    if (!save.settings.notifications[NOTIF_KIND[slot]]) continue;
    const at = slotMoment(slot, save, nowMs);
    if (at === null) continue;
    const day = localDay(at);
    const used = perDay.get(day) ?? 0;
    if (used >= NOTIF.maxPerDay) continue;
    perDay.set(day, used + 1);
    plan.push({
      id: NOTIF.ids[slot],
      at: new Date(at),
      titleKey: `${TEXT_KEY[slot]}.title`,
      bodyKey: `${TEXT_KEY[slot]}.body`,
    });
  }
  return plan.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * The local day to store as `notif.giftDay` when the app opens: the day of the gift notification
 * whose moment has passed (it went out while the app was away). Null when there is nothing new to
 * store: the box was never opened, its moment is still ahead or the day is stored already.
 */
export function giftDayToStore(save: Save, nowMs: number): string | null {
  if (save.gift.nextAt <= 0) return null;
  const at = giftMoment(save.gift.nextAt);
  if (at > nowMs) return null;
  const day = localDay(at);
  return day === save.notif.giftDay ? null : day;
}

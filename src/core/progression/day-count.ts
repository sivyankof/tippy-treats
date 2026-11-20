import { daysBetween } from '../../util/calendar';

/**
 * A counter that belongs to one local day. It starts over only on a day strictly later than the
 * stored one and only when the clock does not look set back, so turning the clock back never
 * refills it (same rule as the streak, `core/progression/streak.ts`).
 */
export interface DayCounter {
  /** Local day `YYYY-MM-DD` the count belongs to, or '' when it never counted. */
  day: string;
  used: number;
}

/** True when `today` opens a new counting day for a counter stored for `storedDay`. */
export function isNewDay(storedDay: string, today: string, clockBack: boolean): boolean {
  if (storedDay === '') return true;
  return !clockBack && daysBetween(storedDay, today) > 0;
}

/** How much of the counter is used today. */
export function usedToday(counter: DayCounter, today: string, clockBack: boolean): number {
  return isNewDay(counter.day, today, clockBack) ? 0 : counter.used;
}

/** The counter with `amount` more used today (a new day starts from zero). */
export function addUsed(
  counter: DayCounter,
  amount: number,
  today: string,
  clockBack: boolean,
): DayCounter {
  const fresh = isNewDay(counter.day, today, clockBack);
  return { day: fresh ? today : counter.day, used: (fresh ? 0 : counter.used) + amount };
}

import { CLOCK_BACK_TOLERANCE_MS, MS_PER_DAY } from '../data/app/clock';

/*
 * Pure calendar arithmetic: no clock, no window, no build flags. `src/core` and the Node scripts
 * (`npm run sim`) import it; the game's time source is `clock.ts`.
 */

/** `ms` shifted by a whole number of days. */
export function applyDayOffset(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Local calendar day as `YYYY-MM-DD` (streak and missions). */
export function localDay(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** UTC calendar day as `YYYY-MM-DD` (the daily tower). */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Milliseconds from `nowMs` to the next local midnight (when the missions are dealt anew). */
export function msUntilLocalMidnight(nowMs: number): number {
  const date = new Date(nowMs);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next.getTime() - nowMs;
}

/** True when the clock is behind `lastSeenAt` by more than the tolerance, i.e. it was set back. */
export function clockWentBack(
  nowMs: number,
  lastSeenAt: number,
  toleranceMs: number = CLOCK_BACK_TOLERANCE_MS,
): boolean {
  return nowMs < lastSeenAt - toleranceMs;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole calendar days from `from` to `to` (both `YYYY-MM-DD`): positive when `to` is later.
 * NaN when either is empty or malformed, so a new player never looks like "yesterday".
 */
export function daysBetween(from: string, to: string): number {
  const a = DAY_PATTERN.exec(from);
  const b = DAY_PATTERN.exec(to);
  if (!a || !b) return Number.NaN;
  const utc = (m: RegExpExecArray): number =>
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((utc(b) - utc(a)) / MS_PER_DAY);
}

/** Local hour of the day (0-23) at `ms`. */
export function localHour(ms: number): number {
  return new Date(ms).getHours();
}

/**
 * The moment `hour`:00 local time on the calendar day `days` after (or before, negative) the day
 * of `ms`. Built from calendar fields, so a daylight-saving change does not shift the hour.
 */
export function atLocalHour(ms: number, days: number, hour: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, hour).getTime();
}

/** `ms` moved by `days` calendar days with the local time of day kept (a DST change does not shift it). */
export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ).getTime();
}

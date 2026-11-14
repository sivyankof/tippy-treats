import { CLOCK_BACK_TOLERANCE_MS, MS_PER_DAY } from '../data/clock';
import { readDebugParams } from './debug-params';

/** `ms` shifted by a whole number of days. */
export function applyDayOffset(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

/** The system clock, never shifted: for what must stay true to the device (`lastSeenAt`, the clock-back check). */
export function realNow(): number {
  return Date.now();
}

/** The one time source of the game: the system clock, shifted by `?dayOffset=` in dev builds. */
export function now(): number {
  const offset = typeof window === 'undefined' ? 0 : (readDebugParams().dayOffset ?? 0);
  return applyDayOffset(Date.now(), offset);
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

/** True when the clock is behind `lastSeenAt` by more than the tolerance, i.e. it was set back. */
export function clockWentBack(
  nowMs: number,
  lastSeenAt: number,
  toleranceMs: number = CLOCK_BACK_TOLERANCE_MS,
): boolean {
  return nowMs < lastSeenAt - toleranceMs;
}

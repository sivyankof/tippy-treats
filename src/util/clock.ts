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

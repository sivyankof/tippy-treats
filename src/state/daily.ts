// The daily tower as pure functions over the save.
import { earn } from '../core/economy';
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
  type DailyPayout,
} from '../core/daily';
import type { Save } from '../core/save/schema';
import type { TeamSlot } from '../core/sim-types';
import { withAdWatched } from './wallet';

/** What the Daily screen shows. */
export interface DailyInfo {
  unlocked: boolean;
  /** UTC day `YYYY-MM-DD`. */
  day: string;
  seed: number;
  team: TeamSlot[];
  attemptsLeft: number;
  canAddAttempt: boolean;
  best: number;
  claimedTiers: number[];
  msUntilNext: number;
}

/** The save with the daily slice of the UTC day `utcDay`; the same save when it is already that day's. */
export function withDailyForDay(save: Save, utcDay: string): Save {
  const daily = dailyForDay(save.daily, utcDay);
  return daily.day === save.daily.day ? save : { ...save, daily };
}

export function infoOf(save: Save, utcDay: string, nowMs: number): DailyInfo {
  const daily = dailyForDay(save.daily, utcDay);
  return {
    unlocked: dailyUnlocked(save.bakerLevel),
    day: utcDay,
    seed: dailySeed(utcDay),
    team: dailyTeam(utcDay),
    attemptsLeft: attemptsLeft(daily),
    canAddAttempt: canAddAttempt(daily),
    best: daily.best,
    claimedTiers: daily.claimedTiers,
    msUntilNext: msUntilNextUtcDay(nowMs),
  };
}

/** The save with one attempt of today spent; null when the tower is locked or no attempt is left. */
export function withAttemptStarted(save: Save, utcDay: string): Save | null {
  if (!dailyUnlocked(save.bakerLevel)) return null;
  const today = withDailyForDay(save, utcDay);
  const daily = startAttempt(today.daily);
  return daily ? { ...today, daily } : null;
}

/** The save with the extra attempt of a watched ad; null when it was already used. */
export function withAttemptAdded(save: Save, utcDay: string): Save | null {
  const today = withDailyForDay(save, utcDay);
  if (!canAddAttempt(today.daily)) return null;
  return withAdWatched({ ...today, daily: addAttempt(today.daily) });
}

/** The save with a finished daily run recorded and its newly reached tiers paid. */
export function withDailyRun(
  save: Save,
  height: number,
  runDay: string,
): { save: Save; paid: DailyPayout[] } {
  const result = recordDailyRun(save.daily, height, runDay);
  let next: Save = { ...save, daily: result.daily };
  for (const payout of result.paid) next = earn(next, payout.cost);
  return { save: next, paid: result.paid };
}

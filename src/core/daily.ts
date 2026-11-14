import { CREATURE_IDS } from '../data/creatures';
import { DAILY } from '../data/daily';
import { MS_PER_DAY } from '../data/clock';
import { LEVEL_REWARDS } from '../data/progression';
import type { Cost } from './economy';
import { Rng } from './rng';
import type { TeamSlot } from './sim-types';

/** The daily tower part of the save. */
export interface DailyState {
  /** UTC day `YYYY-MM-DD`, '' when never played. */
  day: string;
  attemptsUsed: number;
  extraAttemptUsed: boolean;
  best: number;
  claimedTiers: number[];
}

export interface DailyPayout {
  height: number;
  cost: Cost;
}

export interface DailyRunResult {
  daily: DailyState;
  /** Tiers paid by this run, ascending by height. */
  paid: DailyPayout[];
}

/** The date `YYYY-MM-DD` as the number YYYYMMDD; 0 for a malformed day. */
export function dailySeed(utcDay: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(utcDay);
  if (!match) return 0;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

/** The team of the day: distinct creatures drawn by the seed of the day, all at the same level. */
export function dailyTeam(utcDay: string): TeamSlot[] {
  const rng = new Rng(dailySeed(utcDay)).fork(DAILY.teamStream);
  const pool = [...CREATURE_IDS];
  const count = Math.min(DAILY.teamSize, pool.length);
  const team: TeamSlot[] = [];
  for (let i = 0; i < count; i++) {
    const [id] = pool.splice(rng.int(0, pool.length - 1), 1);
    if (id !== undefined) team.push({ id, level: DAILY.teamLevel });
  }
  return team;
}

/** The baker level that opens the daily tower (the `dailyTower` level reward). */
export function dailyUnlockLevel(): number {
  for (const [level, reward] of Object.entries(LEVEL_REWARDS)) {
    if (reward.dailyTower) return Number(level);
  }
  return 1;
}

export function dailyUnlocked(bakerLevel: number): boolean {
  return bakerLevel >= dailyUnlockLevel();
}

/**
 * The slice for `utcDay`: a later day starts over (attempts, extra attempt, best, claimed tiers).
 * The same day, an earlier one (the clock was set back) or an empty day keeps the slice.
 */
export function dailyForDay(daily: DailyState, utcDay: string): DailyState {
  if (utcDay === '' || utcDay <= daily.day) {
    return { ...daily, claimedTiers: [...daily.claimedTiers] };
  }
  return { day: utcDay, attemptsUsed: 0, extraAttemptUsed: false, best: 0, claimedTiers: [] };
}

/** Attempts the player can still start today. */
export function attemptsLeft(daily: DailyState): number {
  const total = DAILY.attempts + (daily.extraAttemptUsed ? DAILY.extraAttempts : 0);
  return Math.max(0, total - daily.attemptsUsed);
}

/** True when the extra attempt for a video is still unused today. */
export function canAddAttempt(daily: DailyState): boolean {
  return !daily.extraAttemptUsed;
}

/** Grants the extra attempt; unchanged (a copy) when it was already used. */
export function addAttempt(daily: DailyState): DailyState {
  return canAddAttempt(daily) ? { ...daily, extraAttemptUsed: true } : { ...daily };
}

/** Spends one attempt; null when none is left. */
export function startAttempt(daily: DailyState): DailyState | null {
  if (attemptsLeft(daily) <= 0) return null;
  return { ...daily, attemptsUsed: daily.attemptsUsed + 1 };
}

/**
 * Records a finished run: the best height rises and every newly reached tier is paid once.
 * `runDay` is the UTC day the attempt was started on; a run that started on another day than
 * the slice (it crossed midnight) changes nothing and pays nothing.
 */
export function recordDailyRun(daily: DailyState, height: number, runDay: string): DailyRunResult {
  if (runDay !== daily.day) {
    return { daily: { ...daily, claimedTiers: [...daily.claimedTiers] }, paid: [] };
  }
  const reached = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0;
  const best = Math.max(daily.best, reached);
  const paid: DailyPayout[] = [];
  const claimedTiers = [...daily.claimedTiers];
  for (const tier of DAILY.tiers) {
    if (best >= tier.height && !claimedTiers.includes(tier.height)) {
      claimedTiers.push(tier.height);
      paid.push({ height: tier.height, cost: { ...tier.reward } });
    }
  }
  return { daily: { ...daily, best, claimedTiers }, paid };
}

/** Milliseconds until 00:00 UTC of the next day (a full day exactly at midnight). */
export function msUntilNextUtcDay(nowMs: number): number {
  return MS_PER_DAY - (((nowMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
}

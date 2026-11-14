import { daysBetween } from '../util/clock';
import { STREAK, STREAK_FIRST_CYCLE_DAY7, STREAK_REWARDS, type StreakReward } from '../data/streak';

export interface StreakState {
  count: number;
  best: number;
  lastDay: string;
  cycle: number;
  claimedDay: string;
}

export type StreakEntry =
  { kind: 'none' } | { kind: 'threat' } | { kind: 'claim'; position: number; reward: StreakReward };

export type CalendarCellState = 'done' | 'today' | 'future';

export interface CalendarCell {
  position: number;
  reward: StreakReward;
  state: CalendarCellState;
}

/** The previous `YYYY-MM-DD` day (month and year boundaries included). */
function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** True when `day` is earlier than the stored day (clock set back, timezone moved west). */
function isBefore(day: string, stored: string): boolean {
  return stored !== '' && daysBetween(stored, day) < 0;
}

/** True when `day` is not later than the stored day. */
function isNotAfter(day: string, stored: string): boolean {
  return stored !== '' && !(daysBetween(stored, day) > 0);
}

/** One missed day with a live streak: the player may still save it. */
export function isThreatened(streak: StreakState, today: string): boolean {
  return (
    streak.count >= 1 && daysBetween(streak.lastDay, today) === STREAK.restorableMissedDays + 1
  );
}

/** Reward of the calendar cell `position` (1..7) in the round `cycle` (0 = the first). */
export function streakReward(position: number, cycle: number): StreakReward {
  if (position === STREAK.cycleLength && cycle === 0) return STREAK_FIRST_CYCLE_DAY7;
  const reward = STREAK_REWARDS[Math.min(Math.max(position, 1), STREAK.cycleLength) - 1];
  if (!reward) throw new Error('streak reward table is short');
  return reward;
}

/** Calendar cell (1..7) that `today` falls on: a new player and a broken streak start at 1. */
export function streakPosition(streak: StreakState, today: string): number {
  let n = 1;
  if (streak.lastDay === today) n = streak.count;
  else if (daysBetween(streak.lastDay, today) === 1) n = streak.count + 1;
  return ((Math.max(n, 1) - 1) % STREAK.cycleLength) + 1;
}

/** What the player meets on entering the game today. */
export function streakEntry(streak: StreakState, today: string, clockBack: boolean): StreakEntry {
  if (clockBack || isNotAfter(today, streak.claimedDay) || isBefore(today, streak.lastDay)) {
    return { kind: 'none' };
  }
  if (isThreatened(streak, today)) return { kind: 'threat' };
  const position = streakPosition(streak, today);
  return { kind: 'claim', position, reward: streakReward(position, streak.cycle) };
}

/** Marks today's reward as claimed (day 7 also ends the round). The caller pays the returned reward. */
export function claimStreak(
  streak: StreakState,
  today: string,
  clockBack: boolean,
): { streak: StreakState; reward: StreakReward; position: number } | null {
  const entry = streakEntry(streak, today, clockBack);
  if (entry.kind !== 'claim') return null;
  const cycle = entry.position === STREAK.cycleLength ? streak.cycle + 1 : streak.cycle;
  return {
    streak: { ...streak, claimedDay: today, cycle },
    reward: entry.reward,
    position: entry.position,
  };
}

/**
 * The missed day is forgiven (the payment is up to the caller): the streak and the calendar go on.
 * Null outside the threat window or with the clock set back, so the caller does not charge.
 */
export function restoreStreak(
  streak: StreakState,
  today: string,
  clockBack: boolean,
): StreakState | null {
  if (clockBack || !isThreatened(streak, today)) return null;
  return { ...streak, lastDay: previousDay(today) };
}

/** The player gave the streak up: it starts over from day 1, the best one stays. Only inside the threat window. */
export function declineStreak(streak: StreakState, today: string): StreakState {
  if (!isThreatened(streak, today)) return streak;
  return { ...streak, count: 0 };
}

/** A finished run: the streak grows once per new day. */
export function countRunDay(streak: StreakState, today: string, clockBack: boolean): StreakState {
  if (clockBack || streak.lastDay === today || isBefore(today, streak.lastDay)) return streak;
  const continues = streak.lastDay === '' || daysBetween(streak.lastDay, today) === 1;
  const count = continues ? streak.count + 1 : 1;
  return { ...streak, count, lastDay: today, best: Math.max(streak.best, count) };
}

/** The 7 calendar cells with their rewards and state relative to today. */
export function calendarCells(streak: StreakState, today: string): CalendarCell[] {
  const position = streakPosition(streak, today);
  const claimed = streak.claimedDay === today;
  // Claiming day 7 has already moved the cycle on; its cell still shows the reward that was paid.
  const cycle = claimed && position === STREAK.cycleLength ? streak.cycle - 1 : streak.cycle;
  return STREAK_REWARDS.map((_, index) => {
    const cell = index + 1;
    let state: CalendarCellState = 'future';
    if (cell < position || (cell === position && claimed)) state = 'done';
    else if (cell === position) state = 'today';
    return { position: cell, reward: streakReward(cell, cycle), state };
  });
}

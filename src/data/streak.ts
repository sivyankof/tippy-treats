import type { CreatureId } from './creatures';

/** What a calendar cell gives. */
export type StreakReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'berries'; amount: number }
  | { kind: 'creature'; id: CreatureId };

export const STREAK = {
  /** Cells in the calendar; it goes round. */
  cycleLength: 7,
  /** Berries that forgive one missed day (the other way is a rewarded video). */
  restoreBerries: 20,
  /** Missed days that still allow a restore; with more the streak is gone. */
  restorableMissedDays: 1,
} as const;

/** Rewards of days 1..7 of the calendar (day 7 as it is after the first cycle). */
export const STREAK_REWARDS: readonly StreakReward[] = [
  { kind: 'coins', amount: 50 },
  { kind: 'coins', amount: 75 },
  { kind: 'berries', amount: 5 },
  { kind: 'coins', amount: 125 },
  { kind: 'berries', amount: 10 },
  { kind: 'coins', amount: 200 },
  { kind: 'berries', amount: 25 },
];

/** Day 7 of the first cycle (`cycle === 0`) gives a creature instead. */
export const STREAK_FIRST_CYCLE_DAY7: StreakReward = { kind: 'creature', id: 'brownie' };

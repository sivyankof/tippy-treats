// The daily streak and its calendar as pure functions over the save.
import { earn, grantCreature, spend, type Cost } from '../core/economy';
import type { Save } from '../core/save/schema';
import {
  calendarCells,
  claimStreak,
  countRunDay,
  declineStreak,
  restoreStreak,
  streakEntry,
  type CalendarCell,
  type StreakEntry,
} from '../core/streak';
import { STREAK, type StreakReward } from '../data/streak';
import { withAdWatched } from './wallet';

/** A claimed calendar reward. */
export interface StreakClaim {
  /** Calendar cell (1..7) that was claimed. */
  position: number;
  reward: StreakReward;
  /** The reward creature was already owned: what was paid instead of it. */
  duplicate: Cost | null;
}

/** How a missed day is forgiven. */
export type RestorePayment = 'ad' | 'berries';

export function entryOf(save: Save, today: string, clockBack: boolean): StreakEntry {
  return streakEntry(save.streak, today, clockBack);
}

export function calendarOf(save: Save, today: string): CalendarCell[] {
  return calendarCells(save.streak, today);
}

/** The save with today's calendar reward paid; null when there is nothing to claim. */
export function withStreakClaimed(
  save: Save,
  today: string,
  clockBack: boolean,
): { save: Save; claim: StreakClaim } | null {
  const claimed = claimStreak(save.streak, today, clockBack);
  if (!claimed) return null;
  const { reward, position } = claimed;
  let next: Save = { ...save, streak: claimed.streak };
  let duplicate: Cost | null = null;
  if (reward.kind === 'creature') {
    const granted = grantCreature(next, reward.id);
    next = granted.value;
    duplicate = granted.duplicate;
  } else {
    next = earn(
      next,
      reward.kind === 'coins' ? { coins: reward.amount } : { berries: reward.amount },
    );
  }
  return { save: next, claim: { position, reward, duplicate } };
}

/**
 * The save with the missed day forgiven and paid for (berries are spent, an ad is counted);
 * null, nothing charged, when the core refuses or the wallet is short.
 */
export function withStreakRestored(
  save: Save,
  today: string,
  clockBack: boolean,
  payment: RestorePayment,
): Save | null {
  const restored = restoreStreak(save.streak, today, clockBack);
  if (!restored) return null;
  if (payment === 'ad') return withAdWatched({ ...save, streak: restored });
  const paid = spend(save, { berries: STREAK.restoreBerries });
  return paid ? { ...paid, streak: restored } : null;
}

export function withStreakDeclined(save: Save, today: string): Save {
  const streak = declineStreak(save.streak, today);
  return streak === save.streak ? save : { ...save, streak };
}

/** The save with today counted for the streak (a run was finished). */
export function withRunDayCounted(save: Save, today: string, clockBack: boolean): Save {
  const streak = countRunDay(save.streak, today, clockBack);
  return streak === save.streak ? save : { ...save, streak };
}

// The interstitial counters of the save as pure functions: sessions, runs and the last show.
import type { Save } from '../core/save/schema';
import { addUsed, usedToday, type DayCounter } from '../core/progression/day-count';

/** A new launch of the app: the session counter grows by one. */
export function withSessionStarted(save: Save): Save {
  return { ...save, ads: { ...save.ads, sessions: save.ads.sessions + 1 } };
}

/** A finished run counts towards the next interstitial. */
export function withRunCounted(save: Save): Save {
  return {
    ...save,
    ads: { ...save.ads, runsSinceInterstitial: save.ads.runsSinceInterstitial + 1 },
  };
}

/** The "No ads" offer was shown on the local day `day`. */
export function withOfferShown(save: Save, day: string): Save {
  return { ...save, ads: { ...save.ads, offerDay: day } };
}

/** The daily interstitial count of the save as the shared per-day counter. */
function shownCounter(save: Save): DayCounter {
  return { day: save.ads.shownDay, used: save.ads.shownToday };
}

/**
 * Interstitials shown on the local day `today`. The count starts over only on a strictly later
 * day and not on a clock that looks set back (`core/progression/day-count.ts`).
 */
export function shownTodayCount(save: Save, today: string, clockBack: boolean): number {
  return usedToday(shownCounter(save), today, clockBack);
}

/** An interstitial was shown at `nowMs` on the local day `today`: the run counter starts over, the day count grows. */
export function withInterstitialShown(
  save: Save,
  nowMs: number,
  today: string,
  clockBack: boolean,
): Save {
  const counter = addUsed(shownCounter(save), 1, today, clockBack);
  return {
    ...save,
    ads: {
      ...save.ads,
      runsSinceInterstitial: 0,
      lastInterstitialAt: nowMs,
      shownDay: counter.day,
      shownToday: counter.used,
    },
  };
}

// The interstitial counters of the save as pure functions: sessions, runs and the last show.
import type { Save } from '../core/save/schema';
import { daysBetween } from '../util/clock';

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

/**
 * Interstitials shown on the local day `today`. The count starts over only when `today` is later
 * than the day of the last show, so a clock set back never gives the day a fresh count.
 */
export function shownTodayCount(save: Save, today: string): number {
  const { shownDay, shownToday } = save.ads;
  return daysBetween(shownDay, today) > 0 ? 0 : shownToday;
}

/** An interstitial was shown at `nowMs` on the local day `today`: the run counter starts over, the day count grows. */
export function withInterstitialShown(save: Save, nowMs: number, today: string): Save {
  const later = daysBetween(save.ads.shownDay, today);
  return {
    ...save,
    ads: {
      ...save.ads,
      runsSinceInterstitial: 0,
      lastInterstitialAt: nowMs,
      // An earlier `today` (clock set back) keeps the later day and its count.
      shownDay: later > 0 || Number.isNaN(later) ? today : save.ads.shownDay,
      shownToday: shownTodayCount(save, today) + 1,
    },
  };
}

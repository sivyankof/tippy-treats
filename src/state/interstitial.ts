// The interstitial counters of the save as pure functions: sessions, runs and the last show.
import type { Save } from '../core/save/schema';

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

/** An interstitial was shown at `nowMs`: the run counter starts over. */
export function withInterstitialShown(save: Save, nowMs: number): Save {
  return { ...save, ads: { ...save.ads, runsSinceInterstitial: 0, lastInterstitialAt: nowMs } };
}

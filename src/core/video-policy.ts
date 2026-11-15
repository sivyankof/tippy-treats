import { BALANCE } from '../data/balance';
import { REWARDED_OFFERS } from '../data/rewarded-video';

/**
 * "×2 coins for an ad" on the results screen: only for a run that reached the save and earned
 * at least `REWARDED_OFFERS.doubleCoinsMin` coins (docs/05-economy-monetization.md, section 6).
 */
export function canOfferDoubleCoins(earned: number, recorded: boolean): boolean {
  return recorded && earned >= REWARDED_OFFERS.doubleCoinsMin;
}

/** Everything the interstitial rules look at, read when the player leaves the results. */
export interface InterstitialContext {
  /** `remove_ads` is bought. */
  removeAds: boolean;
  /** Launch number of the app, 1 for the first one ever. */
  session: number;
  /** Finished runs since the last interstitial. */
  runsSince: number;
  nowMs: number;
  /** When the last interstitial was shown; 0 when there was none. */
  lastShownAt: number;
  /** The player watched a rewarded ad during this run (the continue offer, the ×2 coins). */
  rewardedInRun: boolean;
  /** How long the run lasted. */
  runMs: number;
}

/** The interstitial on leaving the results: all the conditions of docs/05, section 6 at once. */
export function canShowInterstitial(ctx: InterstitialContext): boolean {
  const rules = BALANCE.ads.interstitial;
  return (
    !ctx.removeAds &&
    ctx.session > rules.firstSessionsFree &&
    ctx.runsSince >= rules.minRuns &&
    ctx.nowMs - ctx.lastShownAt >= rules.minGapMs &&
    !ctx.rewardedInRun &&
    ctx.runMs >= rules.minRunMs
  );
}

/** The gentle "no ads" offer: once per session, after the second interstitial shown in it. */
export function shouldOfferRemoveAds(
  removeAds: boolean,
  shownInSession: number,
  offeredInSession: boolean,
): boolean {
  return !removeAds && !offeredInSession && shownInSession >= BALANCE.ads.removeAdsOfferAfter;
}

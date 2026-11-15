import { BALANCE } from '../data/balance';
import { REWARDED_OFFERS } from '../data/rewarded-video';

/**
 * "×2 coins for an ad" on the results screen: only for a run that reached the save and earned
 * at least `REWARDED_OFFERS.doubleCoinsMin` coins, while the day still has doublings `left` (docs/05-economy-monetization.md, section 6).
 */
export function canOfferDoubleCoins(earned: number, recorded: boolean, left: number): boolean {
  return recorded && left > 0 && earned >= REWARDED_OFFERS.doubleCoinsMin;
}

/** Everything the interstitial rules look at, read when the player leaves the results. */
export interface InterstitialContext {
  /** `remove_ads` is bought. */
  removeAds: boolean;
  /** Launch number of the app, 1 for the first one ever. */
  session: number;
  /** When the save was created, epoch ms: the first launch. */
  createdAt: number;
  /** The clock looks set back (behind the last launch by more than the tolerance). */
  clockBehind: boolean;
  /** Finished runs since the last interstitial. */
  runsSince: number;
  nowMs: number;
  /** When the last interstitial was shown; 0 when there was none. */
  lastShownAt: number;
  /** Interstitials shown since this launch of the app. */
  shownInSession: number;
  /** Interstitials shown on the current local day. */
  shownToday: number;
  /** The player watched a rewarded ad during this run (the continue offer, the ×2 coins). */
  rewardedInRun: boolean;
  /** How long the run lasted. */
  runMs: number;
  /** The run beat the best height. */
  newRecord: boolean;
  /** The run raised the baker level. */
  levelUp: boolean;
  /** The run or its results gave a creature (a level reward, the first Honey). */
  newCreature: boolean;
}

/** The part of the context that the screen and the flow know: the run just ended and this launch. */
export type InterstitialRunFacts = Pick<
  InterstitialContext,
  'runMs' | 'rewardedInRun' | 'newRecord' | 'levelUp' | 'newCreature' | 'shownInSession'
>;

/** The interstitial on leaving the results: all the conditions of docs/05, section 6 at once. */
export function canShowInterstitial(ctx: InterstitialContext): boolean {
  const rules = BALANCE.ads.interstitial;
  // A clock set back never lets an ad through: the first-launch pause and the limits cannot be trusted.
  if (ctx.clockBehind || ctx.nowMs < ctx.createdAt) return false;
  const pastStart =
    ctx.session > rules.firstSessionsFree && ctx.nowMs - ctx.createdAt >= rules.firstFreeMs;
  return (
    !ctx.removeAds &&
    pastStart &&
    ctx.runsSince >= rules.minRuns &&
    ctx.nowMs - ctx.lastShownAt >= rules.minGapMs &&
    ctx.shownInSession < rules.maxPerSession &&
    ctx.shownToday < rules.maxPerDay &&
    !ctx.newRecord &&
    !ctx.levelUp &&
    !ctx.newCreature &&
    !ctx.rewardedInRun &&
    ctx.runMs >= rules.minRunMs
  );
}

/**
 * The gentle "no ads" offer on entering Home: due once the session has shown its second
 * interstitial, and at most once per local day (`offerDay` is the day it was last shown).
 */
export function shouldOfferRemoveAds(
  removeAds: boolean,
  shownInSession: number,
  offerDay: string,
  today: string,
): boolean {
  return !removeAds && shownInSession >= BALANCE.ads.removeAdsOfferAfter && offerDay !== today;
}

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { REWARDED_OFFERS } from '../data/rewarded-video';
import {
  canOfferDoubleCoins,
  canShowInterstitial,
  shouldOfferRemoveAds,
  type InterstitialContext,
} from './video-policy';

describe('double coins offer', () => {
  it('needs at least 10 coins earned', () => {
    expect(REWARDED_OFFERS.doubleCoinsMin).toBe(10);
    expect(canOfferDoubleCoins(3, true)).toBe(false);
    expect(canOfferDoubleCoins(9, true)).toBe(false);
    expect(canOfferDoubleCoins(10, true)).toBe(true);
  });

  it('is never offered for a run that did not reach the save', () => {
    expect(canOfferDoubleCoins(50, false)).toBe(false);
  });
});

const ready: InterstitialContext = {
  removeAds: false,
  session: 2,
  runsSince: 3,
  nowMs: 1_000_000,
  lastShownAt: 1_000_000 - 120_000,
  rewardedInRun: false,
  runMs: 15_000,
};

describe('interstitial rules', () => {
  it('uses the numbers of the design document', () => {
    expect(BALANCE.ads.interstitial).toEqual({
      firstSessionsFree: 1,
      minRuns: 3,
      minGapMs: 120_000,
      minRunMs: 15_000,
    });
    expect(BALANCE.ads.removeAdsOfferAfter).toBe(2);
  });

  it('shows when every condition holds exactly at its threshold', () => {
    expect(canShowInterstitial(ready)).toBe(true);
  });

  it('never shows after remove_ads is bought', () => {
    expect(canShowInterstitial({ ...ready, removeAds: true })).toBe(false);
  });

  it('never shows in the first session', () => {
    expect(canShowInterstitial({ ...ready, session: 1 })).toBe(false);
    expect(canShowInterstitial({ ...ready, session: 0 })).toBe(false);
  });

  it('needs three runs since the last one', () => {
    expect(canShowInterstitial({ ...ready, runsSince: 2 })).toBe(false);
    expect(canShowInterstitial({ ...ready, runsSince: 9 })).toBe(true);
  });

  it('needs two minutes since the last one', () => {
    expect(canShowInterstitial({ ...ready, lastShownAt: ready.nowMs - 119_999 })).toBe(false);
    expect(canShowInterstitial({ ...ready, lastShownAt: 0 })).toBe(true);
  });

  it('is skipped when a rewarded ad was watched in the run', () => {
    expect(canShowInterstitial({ ...ready, rewardedInRun: true })).toBe(false);
  });

  it('is skipped after a run shorter than 15 seconds', () => {
    expect(canShowInterstitial({ ...ready, runMs: 14_999 })).toBe(false);
  });

  it('is skipped when the clock went back before the last show', () => {
    expect(canShowInterstitial({ ...ready, lastShownAt: ready.nowMs + 5_000 })).toBe(false);
  });
});

describe('remove ads offer', () => {
  it('comes after the second interstitial of the session, once', () => {
    expect(shouldOfferRemoveAds(false, 1, false)).toBe(false);
    expect(shouldOfferRemoveAds(false, 2, false)).toBe(true);
    expect(shouldOfferRemoveAds(false, 3, true)).toBe(false);
  });

  it('is not made to a player who bought it', () => {
    expect(shouldOfferRemoveAds(true, 2, false)).toBe(false);
  });
});

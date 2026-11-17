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
    expect(canOfferDoubleCoins(3, true, 5, 4)).toBe(false);
    expect(canOfferDoubleCoins(9, true, 5, 4)).toBe(false);
    expect(canOfferDoubleCoins(10, true, 5, 4)).toBe(true);
  });

  it('is not offered once the day has no doublings left', () => {
    expect(canOfferDoubleCoins(50, true, 1, 4)).toBe(true);
    expect(canOfferDoubleCoins(50, true, 0, 4)).toBe(false);
  });

  it('is never offered for a run that did not reach the save', () => {
    expect(canOfferDoubleCoins(50, false, 5, 4)).toBe(false);
  });

  it('is not offered on the results of the first 3 runs', () => {
    expect(canOfferDoubleCoins(50, true, 5, 1)).toBe(false);
    expect(canOfferDoubleCoins(50, true, 5, 2)).toBe(false);
    expect(canOfferDoubleCoins(50, true, 5, 3)).toBe(false);
    expect(canOfferDoubleCoins(50, true, 5, 4)).toBe(true);
  });
});

const DAY = 86_400_000;
const NOW = 10 * DAY;

const ready: InterstitialContext = {
  removeAds: false,
  session: 4,
  createdAt: NOW - DAY,
  runsFinished: 10,
  clockBehind: false,
  runsSince: 4,
  nowMs: NOW,
  lastShownAt: NOW - 180_000,
  shownInSession: 3,
  shownToday: 11,
  rewardedInRun: false,
  runMs: 15_000,
  newRecord: false,
  levelUp: false,
  newCreature: false,
};

describe('interstitial rules', () => {
  it('uses the numbers of the design document', () => {
    expect(BALANCE.ads.interstitial).toEqual({
      firstSessionsFree: 3,
      firstFreeMs: DAY,
      minRuns: 4,
      minGapMs: 180_000,
      maxPerSession: 4,
      maxPerDay: 12,
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

  it('is off for the first three sessions', () => {
    expect(canShowInterstitial({ ...ready, session: 3 })).toBe(false);
    expect(canShowInterstitial({ ...ready, session: 0 })).toBe(false);
    expect(canShowInterstitial({ ...ready, session: 4 })).toBe(true);
  });

  it('is off until 10 runs are finished, whatever the sessions and the time', () => {
    expect(canShowInterstitial({ ...ready, runsFinished: 9 })).toBe(false);
    expect(canShowInterstitial({ ...ready, runsFinished: 0 })).toBe(false);
    expect(canShowInterstitial({ ...ready, runsFinished: 10 })).toBe(true);
    expect(canShowInterstitial({ ...ready, runsFinished: 9, createdAt: NOW - 30 * DAY })).toBe(
      false,
    );
  });

  it('is off for 24 hours after the first launch, whichever of the two ends later', () => {
    expect(canShowInterstitial({ ...ready, createdAt: NOW - DAY + 1 })).toBe(false);
    expect(canShowInterstitial({ ...ready, createdAt: NOW - 30 * DAY, session: 3 })).toBe(false);
    expect(canShowInterstitial({ ...ready, createdAt: NOW - 30 * DAY })).toBe(true);
  });

  it('is off when the clock looks set back', () => {
    expect(canShowInterstitial({ ...ready, clockBehind: true })).toBe(false);
    expect(canShowInterstitial({ ...ready, createdAt: NOW + 1_000 })).toBe(false);
  });

  it('needs four runs since the last one', () => {
    expect(canShowInterstitial({ ...ready, runsSince: 3 })).toBe(false);
    expect(canShowInterstitial({ ...ready, runsSince: 9 })).toBe(true);
  });

  it('needs three minutes since the last one', () => {
    expect(canShowInterstitial({ ...ready, lastShownAt: ready.nowMs - 179_999 })).toBe(false);
    expect(canShowInterstitial({ ...ready, lastShownAt: 0 })).toBe(true);
  });

  it('is skipped when the clock went back before the last show', () => {
    expect(canShowInterstitial({ ...ready, lastShownAt: ready.nowMs + 5_000 })).toBe(false);
  });

  it('shows at most four times per session', () => {
    expect(canShowInterstitial({ ...ready, shownInSession: 4 })).toBe(false);
    expect(canShowInterstitial({ ...ready, shownInSession: 0 })).toBe(true);
  });

  it('shows at most twelve times per local day', () => {
    expect(canShowInterstitial({ ...ready, shownToday: 12 })).toBe(false);
    expect(canShowInterstitial({ ...ready, shownToday: 0 })).toBe(true);
  });

  it('is skipped after a new record, a baker level or a new creature', () => {
    expect(canShowInterstitial({ ...ready, newRecord: true })).toBe(false);
    expect(canShowInterstitial({ ...ready, levelUp: true })).toBe(false);
    expect(canShowInterstitial({ ...ready, newCreature: true })).toBe(false);
  });

  it('is skipped when a rewarded ad was watched in the run', () => {
    expect(canShowInterstitial({ ...ready, rewardedInRun: true })).toBe(false);
  });

  it('is skipped after a run shorter than 15 seconds', () => {
    expect(canShowInterstitial({ ...ready, runMs: 14_999 })).toBe(false);
  });
});

describe('remove ads offer', () => {
  it('is due after the second interstitial of the session, once per local day', () => {
    expect(shouldOfferRemoveAds(false, 1, '', '2026-11-15')).toBe(false);
    expect(shouldOfferRemoveAds(false, 2, '', '2026-11-15')).toBe(true);
    expect(shouldOfferRemoveAds(false, 3, '2026-11-14', '2026-11-15')).toBe(true);
    expect(shouldOfferRemoveAds(false, 3, '2026-11-15', '2026-11-15')).toBe(false);
  });

  it('is not made to a player who bought it', () => {
    expect(shouldOfferRemoveAds(true, 2, '', '2026-11-15')).toBe(false);
  });
});

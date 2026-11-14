import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUB_ADS } from '../../data/rewarded-video';
import { WebAds } from './web';

describe('WebAds', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pays out after the fake ad and shows then removes the overlay', async () => {
    const hide = vi.fn();
    const show = vi.fn(() => hide);
    const ads = new WebAds(show);
    const result = ads.showRewarded();
    expect(show).toHaveBeenCalledOnce();
    expect(ads.isRewardedReady()).toBe(false);
    await vi.advanceTimersByTimeAsync(STUB_ADS.durationMs - 1);
    expect(hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('rewarded');
    expect(hide).toHaveBeenCalledOnce();
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('cycles reward, dismissed, unavailable', () => {
    const ads = new WebAds(() => null);
    expect(ads.mode).toBe('reward');
    expect(ads.cycleMode()).toBe('dismissed');
    expect(ads.cycleMode()).toBe('unavailable');
    expect(ads.cycleMode()).toBe('reward');
  });

  it('closes early in the dismissed mode', async () => {
    const ads = new WebAds(() => null);
    ads.cycleMode();
    const result = ads.showRewarded();
    await vi.advanceTimersByTimeAsync(STUB_ADS.dismissAfterMs);
    await expect(result).resolves.toBe('dismissed');
  });

  it('is unavailable in the unavailable mode and shows nothing', async () => {
    const show = vi.fn(() => null);
    const ads = new WebAds(show);
    ads.cycleMode();
    ads.cycleMode();
    expect(ads.isRewardedReady()).toBe(false);
    await expect(ads.showRewarded()).resolves.toBe('unavailable');
    expect(show).not.toHaveBeenCalled();
  });

  it('runs without a DOM and has no interstitials', async () => {
    const ads = new WebAds();
    const result = ads.showRewarded();
    await vi.advanceTimersByTimeAsync(STUB_ADS.durationMs);
    await expect(result).resolves.toBe('rewarded');
    await expect(ads.maybeShowInterstitial()).resolves.toBe(false);
    await expect(ads.init()).resolves.toBeUndefined();
  });
});

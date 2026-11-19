import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUB_ADS } from '../../data/economy/rewarded-video';
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

  it('cycles reward, dismissed, offline, no_fill', () => {
    const ads = new WebAds(() => null);
    expect(ads.mode).toBe('reward');
    expect(ads.cycleMode()).toBe('dismissed');
    expect(ads.cycleMode()).toBe('offline');
    expect(ads.cycleMode()).toBe('no_fill');
    expect(ads.cycleMode()).toBe('reward');
  });

  it('reports why the ad is unavailable', async () => {
    const show = vi.fn(() => null);
    const ads = new WebAds(show);
    ads.cycleMode();
    ads.cycleMode();
    expect(ads.mode).toBe('offline');
    expect(ads.isRewardedReady()).toBe(false);
    expect(ads.rewardedUnavailableReason()).toBe('offline');
    await expect(ads.showRewarded()).resolves.toBe('unavailable');
    ads.cycleMode();
    expect(ads.rewardedUnavailableReason()).toBe('no_fill');
    await expect(ads.showRewarded()).resolves.toBe('unavailable');
    expect(show).not.toHaveBeenCalled();
    ads.cycleMode();
    expect(ads.isRewardedReady()).toBe(true);
    expect(ads.rewardedUnavailableReason()).toBeNull();
  });

  it('gives no reason while the stub is only busy showing an ad', async () => {
    vi.useFakeTimers();
    try {
      const ads = new WebAds(() => null);
      const shown = ads.showRewarded();
      expect(ads.isRewardedReady()).toBe(false);
      expect(ads.rewardedUnavailableReason()).toBeNull();
      await vi.runAllTimersAsync();
      await shown;
    } finally {
      vi.useRealTimers();
    }
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
    ads.cycleMode();
    expect(ads.isRewardedReady()).toBe(false);
    await expect(ads.showRewarded()).resolves.toBe('unavailable');
    expect(show).not.toHaveBeenCalled();
  });

  it('runs without a DOM', async () => {
    const ads = new WebAds();
    const result = ads.showRewarded();
    await vi.advanceTimersByTimeAsync(STUB_ADS.durationMs);
    await expect(result).resolves.toBe('rewarded');
    await expect(ads.init()).resolves.toBeUndefined();
  });

  it('shows a grey interstitial for the same time, then reports it shown', async () => {
    const hide = vi.fn();
    const show = vi.fn(() => hide);
    const ads = new WebAds(show);
    const result = ads.showInterstitial();
    expect(show).toHaveBeenCalledOnce();
    expect(ads.isRewardedReady()).toBe(false);
    await vi.advanceTimersByTimeAsync(STUB_ADS.durationMs - 1);
    expect(hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(true);
    expect(hide).toHaveBeenCalledOnce();
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('shows no interstitial in the unavailable mode or once ads are removed', async () => {
    const show = vi.fn(() => null);
    const off = new WebAds(show);
    off.cycleMode();
    off.cycleMode();
    off.cycleMode();
    await expect(off.showInterstitial()).resolves.toBe(false);
    const removed = new WebAds(show);
    removed.setRemoveAds(true);
    await expect(removed.showInterstitial()).resolves.toBe(false);
    expect(show).not.toHaveBeenCalled();
  });
});

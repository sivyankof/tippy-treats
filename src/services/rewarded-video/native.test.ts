import { describe, expect, it } from 'vitest';
import { AD_LOAD } from '../../data/economy/rewarded-video';
import type { AdUnits } from './ad-units';
import { NativeAds } from './native';
import type { AdEvent, AdsPlugin } from './plugin';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

class FakePlugin implements AdsPlugin {
  handlers = new Map<AdEvent, () => void>();
  prepared: string[] = [];
  loadFails = 0;
  showFails = false;
  /** Events fired when a show starts, in order. */
  onShow: AdEvent[] = ['rewarded', 'rewardedDismissed'];
  onShowInterstitial: AdEvent[] = ['interstitialDismissed'];
  initFails = false;

  initialize(): Promise<void> {
    return this.initFails ? Promise.reject(new Error('x')) : Promise.resolve();
  }
  private prepare(adId: string): Promise<void> {
    this.prepared.push(adId);
    if (this.loadFails > 0) {
      this.loadFails -= 1;
      return Promise.reject(new Error('no fill'));
    }
    return Promise.resolve();
  }
  prepareRewarded = (adId: string): Promise<void> => this.prepare(adId);
  prepareInterstitial = (adId: string): Promise<void> => this.prepare(adId);
  showRewarded(): Promise<void> {
    if (this.showFails) return Promise.reject(new Error('x'));
    queueMicrotask(() => this.onShow.forEach((e) => this.handlers.get(e)?.()));
    return Promise.resolve();
  }
  showInterstitial(): Promise<void> {
    if (this.showFails) return Promise.reject(new Error('x'));
    queueMicrotask(() => this.onShowInterstitial.forEach((e) => this.handlers.get(e)?.()));
    return Promise.resolve();
  }
  on(event: AdEvent, handler: () => void): Promise<void> {
    this.handlers.set(event, handler);
    return Promise.resolve();
  }
}

const UNITS: AdUnits = { rewarded: 'r', interstitial: 'i' };

function setup(options: { online?: boolean; units?: AdUnits } = {}) {
  const plugin = new FakePlugin();
  const timers: Array<{ run: () => void; delay: number }> = [];
  const ads = new NativeAds(
    plugin,
    options.units ?? UNITS,
    () => options.online ?? true,
    (run, delay) => timers.push({ run, delay }),
  );
  return { plugin, ads, timers };
}

describe('NativeAds', () => {
  it('is unavailable before init', async () => {
    const { ads, plugin } = setup();
    expect(ads.isRewardedReady()).toBe(false);
    expect(ads.rewardedUnavailableReason()).toBe('no_fill');
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(await ads.showInterstitial()).toBe(false);
    expect(plugin.prepared).toEqual([]);
  });

  it('preloads one rewarded and one interstitial after init', async () => {
    const { ads, plugin } = setup();
    await ads.init();
    await flush();
    expect(plugin.prepared).toEqual(['r', 'i']);
    expect(ads.isRewardedReady()).toBe(true);
    expect(ads.rewardedUnavailableReason()).toBeNull();
  });

  it('pays only on the reward and loads the next ad after a show', async () => {
    const { ads, plugin } = setup();
    await ads.init();
    await flush();
    expect(await ads.showRewarded()).toBe('rewarded');
    await flush();
    expect(plugin.prepared).toEqual(['r', 'i', 'r']);
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('answers dismissed when the ad closes without a reward', async () => {
    const { ads, plugin } = setup();
    plugin.onShow = ['rewardedDismissed'];
    await ads.init();
    await flush();
    expect(await ads.showRewarded()).toBe('dismissed');
  });

  it('answers unavailable when the show fails or the plugin rejects', async () => {
    const { ads, plugin } = setup();
    await ads.init();
    await flush();
    plugin.onShow = ['rewardedFailedToShow'];
    expect(await ads.showRewarded()).toBe('unavailable');
    await flush();
    plugin.onShow = [];
    plugin.showFails = true;
    expect(await ads.showRewarded()).toBe('unavailable');
  });

  it('is not ready while another rewarded ad shows, with no reason to give', async () => {
    const { ads, plugin } = setup();
    plugin.onShow = [];
    await ads.init();
    await flush();
    const first = ads.showRewarded();
    expect(ads.isRewardedReady()).toBe(false);
    expect(ads.rewardedUnavailableReason()).toBeNull();
    expect(await ads.showRewarded()).toBe('unavailable');
    plugin.handlers.get('rewardedDismissed')?.();
    expect(await first).toBe('dismissed');
  });

  it('names offline only when the device says there is no network', () => {
    const online = setup();
    const offline = setup({ online: false });
    expect(online.ads.rewardedUnavailableReason()).toBe('no_fill');
    expect(offline.ads.rewardedUnavailableReason()).toBe('offline');
  });

  it('retries a failed load a bounded number of times, then stops until asked', async () => {
    const { ads, plugin, timers } = setup();
    plugin.loadFails = 100;
    await ads.init();
    await flush();
    for (let i = 0; i < AD_LOAD.retryDelaysMs.length * 3; i++) {
      const next = timers.shift();
      if (!next) break;
      next.run();
      await flush();
    }
    // Two kinds of ads, each tried once plus its retries.
    expect(plugin.prepared.length).toBe(2 * (AD_LOAD.retryDelaysMs.length + 1));
    expect(timers).toHaveLength(0);
    expect(ads.isRewardedReady()).toBe(false);
    // Asking starts a fresh try; this time it fills.
    plugin.loadFails = 0;
    expect(await ads.showRewarded()).toBe('unavailable');
    await flush();
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('waits the configured delay before a retry', async () => {
    const { ads, plugin, timers } = setup();
    plugin.loadFails = 1;
    await ads.init();
    await flush();
    expect(timers.map((timer) => timer.delay)).toEqual([AD_LOAD.retryDelaysMs[0]]);
  });

  it('shows an interstitial and reports it; remove-ads stops interstitials only', async () => {
    const { ads } = setup();
    await ads.init();
    await flush();
    expect(await ads.showInterstitial()).toBe(true);
    await flush();
    ads.setRemoveAds(true);
    expect(await ads.showInterstitial()).toBe(false);
    expect(ads.isRewardedReady()).toBe(true);
    expect(await ads.showRewarded()).toBe('rewarded');
  });

  it('has no ads of a kind whose unit id is missing', async () => {
    const { ads, plugin } = setup({ units: {} });
    await ads.init();
    await flush();
    expect(plugin.prepared).toEqual([]);
    expect(ads.isRewardedReady()).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
  });

  it('never throws when the SDK fails to start', async () => {
    const { ads, plugin } = setup();
    plugin.initFails = true;
    await expect(ads.init()).resolves.toBeUndefined();
  });

  it('is unavailable without loads when the SDK fails to start', async () => {
    const { ads, plugin } = setup();
    plugin.initFails = true;
    await ads.init();
    await flush();
    expect(plugin.prepared).toEqual([]);
    expect(ads.isRewardedReady()).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(await ads.showInterstitial()).toBe(false);
  });

  it('is unavailable without loads when an event listener cannot be registered', async () => {
    const { ads, plugin } = setup();
    plugin.on = () => Promise.reject(new Error('x'));
    await ads.init();
    await flush();
    expect(plugin.prepared).toEqual([]);
    expect(await ads.showRewarded()).toBe('unavailable');
  });

  it('settles a rewarded show whose close event never comes, after the safety wait', async () => {
    const { ads, plugin, timers } = setup();
    await ads.init();
    await flush();
    plugin.onShow = [];
    const shown = ads.showRewarded();
    await flush();
    const safety = timers.find((t) => t.delay === AD_LOAD.showSafetyMs);
    expect(safety).toBeDefined();
    safety?.run();
    expect(await shown).toBe('dismissed');
    expect(ads.isRewardedReady()).toBe(false);
  });

  it('still pays a timed-out show whose reward event had fired', async () => {
    const { ads, plugin, timers } = setup();
    await ads.init();
    await flush();
    plugin.onShow = ['rewarded'];
    const shown = ads.showRewarded();
    await flush();
    timers.find((t) => t.delay === AD_LOAD.showSafetyMs)?.run();
    expect(await shown).toBe('rewarded');
  });

  it('a stale safety timer does not touch a later show', async () => {
    const { ads, plugin, timers } = setup();
    await ads.init();
    await flush();
    expect(await ads.showRewarded()).toBe('rewarded');
    const stale = timers.find((t) => t.delay === AD_LOAD.showSafetyMs);
    await flush();
    plugin.onShow = [];
    const second = ads.showRewarded();
    await flush();
    stale?.run();
    let settled = false;
    void second.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);
    timers.filter((t) => t.delay === AD_LOAD.showSafetyMs)[1]?.run();
    expect(await second).toBe('dismissed');
  });

  it('settles an interstitial whose close event never comes', async () => {
    const { ads, plugin, timers } = setup();
    await ads.init();
    await flush();
    plugin.onShowInterstitial = [];
    const shown = ads.showInterstitial();
    await flush();
    timers.find((t) => t.delay === AD_LOAD.showSafetyMs)?.run();
    expect(await shown).toBe(true);
  });
});

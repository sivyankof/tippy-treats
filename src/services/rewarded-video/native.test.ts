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
  /** Loads stay under way until `answer` is called with their outcome. */
  hold = false;
  private held: Array<(filled: boolean) => void> = [];

  /** Ends the loads under way: `filled` true when the network had an ad. */
  answer(filled: boolean): void {
    const held = this.held;
    this.held = [];
    held.forEach((settle) => settle(filled));
  }

  initialize(): Promise<void> {
    return this.initFails ? Promise.reject(new Error('x')) : Promise.resolve();
  }
  private prepare(adId: string): Promise<void> {
    this.prepared.push(adId);
    if (this.hold) {
      return new Promise((resolve, reject) => {
        this.held.push((filled) => (filled ? resolve() : reject(new Error('no fill'))));
      });
    }
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
  const net = { online: options.online ?? true };
  const clock = { ms: 0 };
  const ads = new NativeAds(
    plugin,
    options.units ?? UNITS,
    () => net.online,
    (run, delay) => timers.push({ run, delay }),
    () => clock.ms,
  );
  return { plugin, ads, timers, net, clock };
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

  it('says loading while the load request runs, then nothing once the ad is in', async () => {
    const { ads, plugin } = setup();
    plugin.hold = true;
    await ads.init();
    await flush();
    expect(ads.isRewardedReady()).toBe(false);
    expect(ads.rewardedUnavailableReason()).toBe('loading');
    plugin.answer(true);
    await flush();
    expect(ads.isRewardedReady()).toBe(true);
    expect(ads.rewardedUnavailableReason()).toBeNull();
  });

  it('says loading for the next ad right after a show', async () => {
    const { ads, plugin } = setup();
    await ads.init();
    await flush();
    plugin.hold = true;
    expect(await ads.showRewarded()).toBe('rewarded');
    await flush();
    expect(ads.rewardedUnavailableReason()).toBe('loading');
  });

  it('is not loading in the wait before a retry: the reason is no_fill', async () => {
    const { ads, plugin, timers } = setup();
    plugin.hold = true;
    await ads.init();
    await flush();
    plugin.answer(false);
    await flush();
    expect(timers.length).toBeGreaterThan(0);
    expect(ads.rewardedUnavailableReason()).toBe('no_fill');
    // The retry runs: loading again while its request is under way.
    timers.shift()?.run();
    await flush();
    expect(ads.rewardedUnavailableReason()).toBe('loading');
  });

  it('says no_fill once a load has run longer than the caption limit, though it goes on', async () => {
    const { ads, plugin, clock } = setup();
    plugin.hold = true;
    await ads.init();
    await flush();
    clock.ms = AD_LOAD.loadingCaptionMaxMs - 1;
    expect(ads.rewardedUnavailableReason()).toBe('loading');
    clock.ms = AD_LOAD.loadingCaptionMaxMs;
    expect(ads.rewardedUnavailableReason()).toBe('no_fill');
    // The request was not dropped: when it answers, the ad is ready.
    plugin.answer(true);
    await flush();
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('puts offline above loading', async () => {
    const { ads, plugin, net } = setup();
    plugin.hold = true;
    await ads.init();
    await flush();
    net.online = false;
    expect(ads.rewardedUnavailableReason()).toBe('offline');
    net.online = true;
    expect(ads.rewardedUnavailableReason()).toBe('loading');
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

  it('wakes after the retries gave up: the network is back after 10 minutes', async () => {
    const { ads, plugin, timers, net, clock } = setup();
    plugin.loadFails = 100;
    net.online = false;
    await ads.init();
    await flush();
    for (let i = 0; i < AD_LOAD.retryDelaysMs.length * 3; i++) {
      timers.shift()?.run();
      await flush();
    }
    expect(timers).toHaveLength(0);
    expect(ads.isRewardedReady()).toBe(false);
    clock.ms += 10 * 60 * 1000;
    net.online = true;
    plugin.loadFails = 0;
    ads.wake();
    await flush();
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('wake starts no parallel load and restarts the count of failures', async () => {
    const { ads, plugin, timers } = setup();
    plugin.hold = true;
    await ads.init();
    await flush();
    const loads = plugin.prepared.length;
    ads.wake();
    ads.wake();
    expect(plugin.prepared.length).toBe(loads);
    plugin.answer(false);
    await flush();
    expect(timers.map((timer) => timer.delay)).toEqual([
      AD_LOAD.retryDelaysMs[0],
      AD_LOAD.retryDelaysMs[0],
    ]);
  });

  it('the network back replaces a waiting retry: the old timer does nothing', async () => {
    const { ads, plugin, timers } = setup();
    plugin.loadFails = 2;
    await ads.init();
    await flush();
    const before = plugin.prepared.length;
    ads.wake();
    await flush();
    // A plain wake leaves the waiting retry to its timer.
    expect(plugin.prepared.length).toBe(before);
    ads.wake(true);
    await flush();
    expect(ads.isRewardedReady()).toBe(true);
    const loaded = plugin.prepared.length;
    expect(loaded).toBeGreaterThan(before);
    for (const timer of timers.splice(0)) timer.run();
    await flush();
    expect(plugin.prepared.length).toBe(loaded);
  });

  it('a wake after the retries gave up waits the gap since the last failure', async () => {
    const { ads, plugin, timers, clock } = setup();
    plugin.loadFails = 100;
    await ads.init();
    await flush();
    for (let i = 0; i < AD_LOAD.retryDelaysMs.length * 3; i++) {
      timers.shift()?.run();
      await flush();
    }
    const gaveUp = plugin.prepared.length;
    ads.wake();
    await flush();
    expect(plugin.prepared.length).toBe(gaveUp);
    clock.ms += AD_LOAD.wakeGapMs;
    ads.wake();
    await flush();
    expect(plugin.prepared.length).toBeGreaterThan(gaveUp);
  });

  it('a wake never loads an interstitial for a player with "No ads"', async () => {
    const { ads, plugin, timers, clock } = setup();
    plugin.loadFails = 100;
    await ads.init();
    await flush();
    ads.setRemoveAds(true);
    for (let i = 0; i < AD_LOAD.retryDelaysMs.length * 3; i++) {
      timers.shift()?.run();
      await flush();
    }
    clock.ms += AD_LOAD.wakeGapMs;
    const before = plugin.prepared.filter((unit) => unit === 'i').length;
    ads.wake(true);
    await flush();
    expect(plugin.prepared.filter((unit) => unit === 'i').length).toBe(before);
  });

  it('tells when a fullscreen ad is on show', async () => {
    const { ads } = setup();
    await ads.init();
    await flush();
    expect(ads.isShowing()).toBe(false);
    const shown = ads.showRewarded();
    expect(ads.isShowing()).toBe(true);
    await shown;
    expect(ads.isShowing()).toBe(false);
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

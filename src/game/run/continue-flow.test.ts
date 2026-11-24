import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { CONTINUE_ANIM } from '../../data/run/continue-anim';
import { AD_BUTTON_WATCH } from '../../data/economy/rewarded-video';
import type {
  RewardedResult,
  RewardedUnavailableReason,
} from '../../services/rewarded-video/types';
import { ContinueFlow } from './continue-flow';
import { createTestState } from '../../state/test-state';

function setup(
  adResult: RewardedResult | 'never' = 'rewarded',
  ready = true,
  berries = 0,
  runsFinished = 3,
) {
  const wallet = createTestState();
  wallet.addBerries(berries);
  let release: (r: RewardedResult) => void = () => {};
  /** The ad service as the test sets it; a failed show leaves the next ad loading. */
  const service = { ready, reason: 'no_fill' as RewardedUnavailableReason };
  const ads = {
    init: vi.fn(),
    isRewardedReady: () => service.ready,
    rewardedUnavailableReason: () => (service.ready ? null : service.reason),
    showRewarded: vi.fn(
      () =>
        new Promise<RewardedResult>((resolve) => {
          if (adResult === 'unavailable')
            Object.assign(service, { ready: false, reason: 'loading' });
          if (adResult === 'never') release = resolve;
          else resolve(adResult);
        }),
    ),
    maybeShowInterstitial: vi.fn(),
    setRemoveAds: vi.fn(),
  };
  const flow = new ContinueFlow({ ads, wallet, player: { runsFinished } });
  return { flow, wallet, ads, service, release: (r: RewardedResult) => release(r) };
}

describe('ContinueFlow', () => {
  it('does not open in the first 3 runs of a player, so the run declines at once', () => {
    expect(setup('rewarded', true, 100, 2).flow.open('classic', 0)).toBe(false);
    expect(setup('rewarded', true, 100, 3).flow.open('classic', 0)).toBe(true);
  });

  it('does not open with too few berries and the ad unavailable, so the run declines at once', () => {
    const { flow } = setup('unavailable', false, 1);
    expect(flow.open('classic', 0)).toBe(false);
    expect(flow.isOpen).toBe(false);
    expect(flow.takeAction()).toBeNull();
  });

  it('does not open when there is no way to pay', () => {
    const { flow } = setup('rewarded', false, 3);
    expect(flow.open('classic', 0)).toBe(false);
    expect(flow.isOpen).toBe(false);
  });

  it('declines when the timer runs out', () => {
    const { flow } = setup();
    flow.open('classic', 0);
    flow.update(BALANCE.continues.offerMs - 1);
    expect(flow.takeAction()).toBeNull();
    flow.update(1);
    expect(flow.takeAction()).toBe('decline');
    expect(flow.isOpen).toBe(false);
  });

  it('ignores "No thanks" during the guard time', () => {
    const { flow } = setup();
    flow.open('classic', 0);
    flow.decline();
    expect(flow.takeAction()).toBeNull();
    flow.update(CONTINUE_ANIM.inputDelayMs);
    flow.decline();
    expect(flow.takeAction()).toBe('decline');
  });

  it('takes no ad or berry tap before the buttons switch on', async () => {
    const { flow, wallet } = setup('rewarded', true, 100);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs - 1);
    expect(flow.inputReady).toBe(false);
    expect(flow.payWithBerries()).toBe(false);
    await flow.watchAd();
    expect(wallet.berries).toBe(100);
    expect(flow.takeAction()).toBeNull();
    flow.update(1);
    expect(flow.inputReady).toBe(true);
    expect(flow.payWithBerries()).toBe(true);
  });

  it('keeps a paid continue when "No thanks" follows in the same frame', () => {
    const { flow, wallet } = setup('rewarded', true, 100);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    const before = wallet.berries;
    const cost = flow.offer?.berryCost ?? 0;
    expect(cost).toBeGreaterThan(0);
    expect(flow.payWithBerries()).toBe(true);
    flow.decline();
    flow.update(CONTINUE_ANIM.balance.paidHoldMs);
    expect(flow.takeAction()).toBe('continue');
    expect(wallet.berries).toBe(before - cost);
  });

  it('continues after a rewarded ad', async () => {
    const { flow } = setup('rewarded');
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    await flow.watchAd();
    expect(flow.takeAction()).toBe('continue');
  });

  it('keeps the timer still while the ad shows, then resumes it', async () => {
    const { flow, release } = setup('never');
    flow.open('classic', 0);
    flow.update(1000);
    const shown = flow.watchAd();
    expect(flow.adBusy).toBe(true);
    flow.update(10000);
    expect(flow.remainingMs).toBe(BALANCE.continues.offerMs - 1000);
    release('dismissed');
    await shown;
    expect(flow.adBusy).toBe(false);
    expect(flow.takeAction()).toBeNull();
    flow.update(500);
    expect(flow.remainingMs).toBe(BALANCE.continues.offerMs - 1500);
  });

  it('disables the ad button when the ad turns out unavailable', async () => {
    const { flow } = setup('unavailable', true, 20);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    await flow.watchAd();
    expect(flow.offer).toEqual({ ad: 'unavailable', berryCost: 15, berriesMissing: 0 });
    expect(flow.adReason).toBe('loading');
    expect(flow.takeAction()).toBeNull();
  });

  it('switches the ad button on once the loading ad has loaded, with the timer untouched', async () => {
    const { flow, service, ads } = setup('rewarded', false, 20);
    service.reason = 'loading';
    flow.open('classic', 0);
    expect(flow.offer?.ad).toBe('unavailable');
    expect(flow.adReason).toBe('loading');
    flow.update(CONTINUE_ANIM.inputDelayMs);
    service.ready = true;
    // Not every frame: the service is looked at again only after the poll interval.
    flow.update(1);
    expect(flow.offer?.ad).toBe('unavailable');
    flow.update(AD_BUTTON_WATCH.pollMs);
    expect(flow.offer?.ad).toBe('ready');
    expect(flow.adReason).toBeNull();
    expect(flow.remainingMs).toBe(
      BALANCE.continues.offerMs - CONTINUE_ANIM.inputDelayMs - 1 - AD_BUTTON_WATCH.pollMs,
    );
    await flow.watchAd();
    expect(ads.showRewarded).toHaveBeenCalledOnce();
    expect(flow.takeAction()).toBe('continue');
  });

  it('turns "Loading…" into "Ad unavailable" when the load gives up', () => {
    const { flow, service } = setup('rewarded', false, 20);
    service.reason = 'loading';
    flow.open('classic', 0);
    service.reason = 'no_fill';
    flow.update(AD_BUTTON_WATCH.pollMs);
    expect(flow.offer?.ad).toBe('unavailable');
    expect(flow.adReason).toBe('no_fill');
  });

  it('greys a ready ad button out when its ad goes away while the window is open', () => {
    const { flow, service } = setup('rewarded', true, 20);
    flow.open('classic', 0);
    service.ready = false;
    service.reason = 'offline';
    flow.update(AD_BUTTON_WATCH.pollMs);
    expect(flow.offer?.ad).toBe('unavailable');
    expect(flow.adReason).toBe('offline');
  });

  it('leaves a later offer without an ad button as it is', () => {
    const { flow, service } = setup('rewarded', true, 100);
    flow.open('classic', 1);
    expect(flow.offer?.ad).toBeNull();
    service.ready = false;
    flow.update(AD_BUTTON_WATCH.pollMs);
    expect(flow.offer?.ad).toBeNull();
    expect(flow.adReason).toBeNull();
  });

  it('spends berries and continues', () => {
    const { flow, wallet } = setup('rewarded', true, 20);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    expect(flow.payWithBerries()).toBe(true);
    expect(wallet.berries).toBe(5);
    expect(flow.takeAction()).toBeNull();
    flow.update(CONTINUE_ANIM.balance.paidHoldMs);
    expect(flow.takeAction()).toBe('continue');
  });

  it('keeps the window open while the payment is shown', () => {
    const { flow } = setup('rewarded', true, 20);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    flow.payWithBerries();
    expect(flow.paying).toBe(true);
    flow.update(CONTINUE_ANIM.balance.paidHoldMs - 1);
    expect(flow.isOpen).toBe(true);
    expect(flow.takeAction()).toBeNull();
    flow.update(1);
    expect(flow.paying).toBe(false);
    expect(flow.takeAction()).toBe('continue');
  });

  it('opens with the ad and a short berry price, and a tap on the price takes nothing', () => {
    const { flow, wallet } = setup('rewarded', true, 14);
    expect(flow.open('classic', 0)).toBe(true);
    expect(flow.offer).toEqual({ ad: 'ready', berryCost: 15, berriesMissing: 1 });
    expect(flow.payWithBerries()).toBe(false);
    expect(wallet.berries).toBe(14);
    expect(flow.takeAction()).toBeNull();
  });

  it('reports the wallet balance for the counter, and the new one after paying', () => {
    const { flow } = setup('rewarded', true, 20);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.inputDelayMs);
    expect(flow.balance).toBe(20);
    flow.payWithBerries();
    expect(flow.balance).toBe(5);
  });

  it('does not open the second continue when berries are short (no ad there)', () => {
    const { flow } = setup('rewarded', true, 29);
    expect(flow.open('classic', 1)).toBe(false);
  });

  it('forgets a late ad result after dispose', async () => {
    const { flow, release } = setup('never');
    flow.open('classic', 0);
    const shown = flow.watchAd();
    flow.dispose();
    release('rewarded');
    await shown;
    expect(flow.takeAction()).toBeNull();
  });
});

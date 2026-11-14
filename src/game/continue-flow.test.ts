import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../data/balance';
import { CONTINUE_ANIM } from '../data/continue-anim';
import type { RewardedResult } from '../services/ads/types';
import { ContinueFlow } from './continue-flow';
import { createTestState } from '../state/test-state';

function setup(adResult: RewardedResult | 'never' = 'rewarded', ready = true, berries = 0) {
  const wallet = createTestState();
  wallet.addBerries(berries);
  const audio = { suspend: vi.fn(), resume: vi.fn() };
  let release: (r: RewardedResult) => void = () => {};
  const ads = {
    init: vi.fn(),
    isRewardedReady: () => ready,
    showRewarded: vi.fn(
      () =>
        new Promise<RewardedResult>((resolve) => {
          if (adResult === 'never') release = resolve;
          else resolve(adResult);
        }),
    ),
    maybeShowInterstitial: vi.fn(),
    setRemoveAds: vi.fn(),
  };
  const flow = new ContinueFlow({ ads, audio, wallet });
  return { flow, wallet, audio, ads, release: (r: RewardedResult) => release(r) };
}

describe('ContinueFlow', () => {
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
    flow.update(CONTINUE_ANIM.declineDelayMs);
    flow.decline();
    expect(flow.takeAction()).toBe('decline');
  });

  it('keeps a paid continue when "No thanks" follows in the same frame', () => {
    const { flow, wallet } = setup('rewarded', true, 100);
    flow.open('classic', 0);
    flow.update(CONTINUE_ANIM.declineDelayMs);
    const before = wallet.berries;
    const cost = flow.offer?.berryCost ?? 0;
    expect(cost).toBeGreaterThan(0);
    expect(flow.payWithBerries()).toBe(true);
    flow.decline();
    expect(flow.takeAction()).toBe('continue');
    expect(wallet.berries).toBe(before - cost);
  });

  it('continues after a rewarded ad, with the audio suspended around it', async () => {
    const { flow, audio } = setup('rewarded');
    flow.open('classic', 0);
    const shown = flow.watchAd();
    expect(audio.suspend).toHaveBeenCalledOnce();
    await shown;
    expect(audio.resume).toHaveBeenCalledOnce();
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
    await flow.watchAd();
    expect(flow.offer).toEqual({ ad: 'unavailable', berryCost: 15 });
    expect(flow.takeAction()).toBeNull();
  });

  it('spends berries and continues', () => {
    const { flow, wallet } = setup('rewarded', true, 20);
    flow.open('classic', 0);
    expect(flow.payWithBerries()).toBe(true);
    expect(wallet.berries).toBe(5);
    expect(flow.takeAction()).toBe('continue');
  });

  it('cannot pay what it does not offer', () => {
    const { flow, wallet } = setup('rewarded', true, 14);
    flow.open('classic', 0);
    expect(flow.payWithBerries()).toBe(false);
    expect(wallet.berries).toBe(14);
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

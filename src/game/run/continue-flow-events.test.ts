import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { CONTINUE_ANIM } from '../../data/run/continue-anim';
import type { RewardedResult } from '../../services/rewarded-video/types';
import { ContinueFlow } from './continue-flow';

const READY_MS = 1000;

function setup(berries: number, ad: 'rewarded' | 'dismissed') {
  const telemetry = { logEvent: vi.fn() };
  const wallet = {
    berries,
    spendBerries: vi.fn(() => true),
  };
  const ads = {
    isRewardedReady: () => true,
    showRewarded: vi.fn(() => Promise.resolve(ad as RewardedResult)),
    maybeShowInterstitial: vi.fn(),
    setRemoveAds: vi.fn(),
  };
  const flow = new ContinueFlow({
    ads,
    wallet,
    player: { runsFinished: 10 },
    telemetry,
  });
  return { flow, telemetry, wallet };
}

describe('ContinueFlow events', () => {
  it('logs continue_offer with the height and the options', () => {
    const { flow, telemetry } = setup(100, 'rewarded');
    flow.open('classic', 0, 24);
    expect(telemetry.logEvent).toHaveBeenCalledWith('continue_offer', {
      height: 24,
      option: 'both',
    });
  });

  it('logs continue_used with method berries and pays under the item continue', () => {
    const { flow, telemetry, wallet } = setup(100, 'rewarded');
    flow.open('classic', 0, 24);
    flow.update(READY_MS);
    expect(flow.payWithBerries()).toBe(true);
    expect(wallet.spendBerries).toHaveBeenCalledWith(BALANCE.continues.berryCosts[0], 'continue');
    flow.update(CONTINUE_ANIM.balance.paidHoldMs);
    expect(flow.takeAction()).toBe('continue');
    expect(telemetry.logEvent).toHaveBeenLastCalledWith('continue_used', {
      height: 24,
      method: 'berries',
    });
  });

  it('logs continue_used with method ad after a watched ad', async () => {
    const { flow, telemetry } = setup(0, 'rewarded');
    flow.open('classic', 0, 9);
    flow.update(READY_MS);
    await flow.watchAd();
    expect(flow.takeAction()).toBe('continue');
    expect(telemetry.logEvent).toHaveBeenLastCalledWith('continue_used', {
      height: 9,
      method: 'ad',
    });
  });

  it('logs no continue_used for a decline', () => {
    const { flow, telemetry } = setup(100, 'rewarded');
    flow.open('classic', 0, 24);
    flow.update(READY_MS);
    flow.decline();
    expect(flow.takeAction()).toBe('decline');
    expect(telemetry.logEvent).toHaveBeenCalledTimes(1);
  });

  it('logs nothing without a service', () => {
    const flow = new ContinueFlow({
      ads: {
        isRewardedReady: () => true,
        showRewarded: () => Promise.resolve('dismissed'),
      },
      wallet: { berries: 100, spendBerries: () => true },
      player: { runsFinished: 10 },
    });
    expect(() => flow.open('classic', 0, 5)).not.toThrow();
  });
});

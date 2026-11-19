import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import type { RewardedResult } from '../../services/rewarded-video/types';
import { loadTestState } from '../../state/test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

const h = vi.hoisted(() => ({
  state: null as unknown,
  audio: { suspend: vi.fn(), resume: vi.fn() },
  ads: {
    isRewardedReady: () => true,
    showRewarded: vi.fn<(placement: string) => Promise<RewardedResult>>(),
    showInterstitial: vi.fn(() => Promise.resolve(true)),
  },
  telemetry: { logEvent: vi.fn(), setUserProperty: vi.fn() },
}));

vi.mock('../../state', () => ({
  get gameState() {
    return h.state;
  },
}));
vi.mock('../../services', () => ({
  services: { audio: h.audio, ads: h.ads, telemetry: h.telemetry },
}));
vi.mock('./purchases', () => ({ loadPrices: () => Promise.resolve({}) }));
vi.mock('../ui/menu/shop/premium-offer', () => ({ openNoAdsOffer: vi.fn() }));

const exit = {
  runMs: 60_000,
  recorded: true,
  newRecord: false,
  levelUp: false,
  newCreature: false,
};

/** A player with every checkpoint open; the interstitial rules pass except "rewarded ad in this run". */
async function player() {
  const base = createDefaultSave(T0, 'test');
  const state = await loadTestState(
    {
      ...base,
      checkpoints: [20, 40, 60, 80, 100],
      berries: 100,
      tutorial: { ...base.tutorial, hintsShown: ['tutorial'] },
    },
    { ms: T0 },
  );
  vi.spyOn(state, 'canShowInterstitial').mockImplementation((facts) => !facts.rewardedInRun);
  h.state = state;
  return state;
}

describe('interstitial after a run from a checkpoint', () => {
  beforeEach(() => {
    h.ads.showInterstitial.mockClear();
    h.ads.showRewarded.mockReset();
  });

  it('does not come after a run whose start an ad paid for, only that run', async () => {
    await player();
    h.ads.showRewarded.mockResolvedValue('rewarded');
    const { payForCheckpoint } = await import('../run/checkpoint-start');
    const { beginRunRewardedMemo } = await import('./rewarded');
    const { leaveResultsAds } = await import('./interstitial-flow');
    const { checkpointRun, CLASSIC_RUN } = await import('../run/run-request');

    expect(await payForCheckpoint(20, 'ad')).toBe('paid');
    const request = checkpointRun(20, true);
    beginRunRewardedMemo(request.kind === 'classic' && request.paidByAd === true);
    await leaveResultsAds(exit);
    expect(h.ads.showInterstitial).not.toHaveBeenCalled();

    // The next run (from zero, no ad) follows the usual rules again.
    beginRunRewardedMemo(CLASSIC_RUN.kind === 'classic' && CLASSIC_RUN.paidByAd === true);
    await leaveResultsAds(exit);
    expect(h.ads.showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('follows the usual rules after a run whose start berries paid for, and after the next', async () => {
    await player();
    const { payForCheckpoint } = await import('../run/checkpoint-start');
    const { beginRunRewardedMemo } = await import('./rewarded');
    const { leaveResultsAds } = await import('./interstitial-flow');

    expect(await payForCheckpoint(40, 'berries')).toBe('paid');
    beginRunRewardedMemo(false);
    await leaveResultsAds(exit);
    expect(h.ads.showInterstitial).toHaveBeenCalledTimes(1);

    beginRunRewardedMemo(false);
    await leaveResultsAds(exit);
    expect(h.ads.showInterstitial).toHaveBeenCalledTimes(2);
  });
});

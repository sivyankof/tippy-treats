import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RewardedResult } from '../services/rewarded-video/types';
import { createTestState } from '../state/test-state';

const h = vi.hoisted(() => ({
  audio: { suspend: vi.fn(), resume: vi.fn() },
  ads: { showRewarded: vi.fn<(placement: string) => Promise<RewardedResult>>() },
}));
const state = createTestState();

vi.mock('../state', () => ({ gameState: state }));
vi.mock('../services', () => ({ services: { audio: h.audio, ads: h.ads } }));

describe('showRewarded', () => {
  beforeEach(() => {
    h.audio.suspend.mockClear();
    h.audio.resume.mockClear();
    h.ads.showRewarded.mockReset();
  });

  it('suspends the sound around the ad, counts a rewarded ad once and remembers it for the run', async () => {
    const { showRewarded, beginRunRewardedMemo, rewardedWatchedInRun } = await import('./rewarded');
    beginRunRewardedMemo();
    h.ads.showRewarded.mockResolvedValue('rewarded');
    const before = state.data.stats.adsWatched;

    const pending = showRewarded('continue');
    expect(h.audio.suspend).toHaveBeenCalledWith('ad');
    expect(h.audio.resume).not.toHaveBeenCalled();
    expect(await pending).toBe('rewarded');

    expect(h.audio.resume).toHaveBeenCalledWith('ad');
    expect(state.data.stats.adsWatched).toBe(before + 1);
    expect(rewardedWatchedInRun()).toBe(true);
  });

  it('counts nothing when the ad was dismissed', async () => {
    const { showRewarded, beginRunRewardedMemo, rewardedWatchedInRun } = await import('./rewarded');
    beginRunRewardedMemo();
    h.ads.showRewarded.mockResolvedValue('dismissed');
    const before = state.data.stats.adsWatched;
    expect(await showRewarded('shop_coins')).toBe('dismissed');
    expect(state.data.stats.adsWatched).toBe(before);
    expect(rewardedWatchedInRun()).toBe(false);
    expect(h.audio.resume).toHaveBeenCalledOnce();
  });

  it('treats a broken service as unavailable and still resumes the sound', async () => {
    const { showRewarded } = await import('./rewarded');
    h.ads.showRewarded.mockRejectedValue(new Error('sdk'));
    const before = state.data.stats.adsWatched;
    expect(await showRewarded('gift_double')).toBe('unavailable');
    expect(state.data.stats.adsWatched).toBe(before);
    expect(h.audio.suspend).toHaveBeenCalledOnce();
    expect(h.audio.resume).toHaveBeenCalledOnce();
  });
});

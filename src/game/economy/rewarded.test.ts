import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RewardedResult } from '../../services/rewarded-video/types';
import { createTestState } from '../../state/test-state';

const h = vi.hoisted(() => ({
  audio: { suspend: vi.fn(), resume: vi.fn() },
  ads: {
    showRewarded: vi.fn<(placement: string) => Promise<RewardedResult>>(),
    rewardedUnavailableReason: vi.fn<() => 'offline' | 'no_fill' | null>(() => null),
  },
  telemetry: { logEvent: vi.fn(), setUserProperty: vi.fn() },
}));
const state = createTestState();

vi.mock('../../state', () => ({ gameState: state }));
vi.mock('../../services', () => ({
  services: { audio: h.audio, ads: h.ads, telemetry: h.telemetry },
}));

describe('showRewarded', () => {
  beforeEach(() => {
    h.audio.suspend.mockClear();
    h.audio.resume.mockClear();
    h.ads.showRewarded.mockReset();
    h.telemetry.logEvent.mockClear();
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

  it('logs the show and the result of every placement', async () => {
    const { showRewarded } = await import('./rewarded');
    h.ads.showRewarded.mockResolvedValue('dismissed');
    await showRewarded('checkpoint_start');
    expect(h.telemetry.logEvent.mock.calls).toEqual([
      ['ad_rewarded_show', { placement: 'checkpoint_start' }],
      ['ad_rewarded_result', { placement: 'checkpoint_start', result: 'dismissed' }],
    ]);
  });

  it('logs why the ad was unavailable', async () => {
    const { showRewarded } = await import('./rewarded');
    h.ads.showRewarded.mockResolvedValue('unavailable');
    h.ads.rewardedUnavailableReason.mockReturnValue('offline');
    await showRewarded('shop_coins');
    expect(h.telemetry.logEvent).toHaveBeenLastCalledWith('ad_rewarded_result', {
      placement: 'shop_coins',
      result: 'unavailable',
      reason: 'offline',
    });
  });

  it('leaves the reason out when the service names none (busy, or the ad call threw)', async () => {
    const { showRewarded } = await import('./rewarded');
    h.ads.showRewarded.mockRejectedValue(new Error('boom'));
    h.ads.rewardedUnavailableReason.mockReturnValue(null);
    await showRewarded('shop_coins');
    expect(h.telemetry.logEvent).toHaveBeenLastCalledWith('ad_rewarded_result', {
      placement: 'shop_coins',
      result: 'unavailable',
    });
  });
});

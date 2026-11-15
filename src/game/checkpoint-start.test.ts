import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../data/balance';
import type { RewardedResult } from '../services/rewarded-video/types';
import { createDefaultSave } from '../core/save/defaults';
import { createTestState, loadTestState } from '../state/test-state';
import { logCheckpointOffer, payForCheckpoint, type CheckpointStartDeps } from './checkpoint-start';

vi.mock('../services', () => ({ services: {} }));
vi.mock('../state', () => ({ gameState: {} }));
vi.mock('./rewarded', () => ({ showRewarded: vi.fn() }));

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);
const PRICE_40 = BALANCE.checkpoints.berries[40];

async function setup(
  over: Record<string, unknown> = {},
  adAnswer: RewardedResult = 'rewarded',
  adReady = true,
) {
  const base = createDefaultSave(T0, 'test');
  const state = await loadTestState(
    { ...base, checkpoints: [20, 40, 60, 80, 100], berries: 100, ...over },
    { ms: T0 },
  );
  let release: (() => void) | null = null;
  const showRewarded = vi.fn(
    () =>
      new Promise<RewardedResult>((resolve) => {
        release = () => resolve(adAnswer);
      }),
  );
  const telemetry = { logEvent: vi.fn() };
  const deps: CheckpointStartDeps = { state, adReady: () => adReady, showRewarded, telemetry };
  return { state, deps, showRewarded, telemetry, finishAd: () => release?.() };
}

describe('payForCheckpoint with berries', () => {
  it('spends the price and logs the start and the spend', async () => {
    const { state, deps, telemetry } = await setup();
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('paid');
    expect(state.berries).toBe(100 - PRICE_40);
    expect(telemetry.logEvent).toHaveBeenCalledWith('currency_spend', {
      currency: 'berries',
      amount: PRICE_40,
      item: 'checkpoint_40',
    });
    expect(telemetry.logEvent).toHaveBeenCalledWith('checkpoint_start', {
      height: 40,
      method: 'berries',
      price: PRICE_40,
    });
  });

  it('is short when the berries do not cover it: nothing spent, nothing logged', async () => {
    const { state, deps, telemetry } = await setup({ berries: PRICE_40 - 1 });
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('short');
    expect(state.berries).toBe(PRICE_40 - 1);
    expect(telemetry.logEvent).not.toHaveBeenCalled();
  });

  it('refuses a locked checkpoint', async () => {
    const { state, deps, telemetry } = await setup({ checkpoints: [20] });
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('refused');
    expect(state.berries).toBe(100);
    expect(telemetry.logEvent).not.toHaveBeenCalled();
  });
});

describe('payForCheckpoint with an ad', () => {
  it('counts the ad start only after the reward and logs a zero price', async () => {
    const { state, deps, showRewarded, telemetry, finishAd } = await setup();
    const pending = payForCheckpoint(20, 'ad', deps);
    expect(showRewarded).toHaveBeenCalledWith('checkpoint_start');
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay);
    finishAd();
    expect(await pending).toBe('paid');
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay - 1);
    expect(state.berries).toBe(100);
    expect(telemetry.logEvent).toHaveBeenCalledWith('checkpoint_start', {
      height: 20,
      method: 'ad',
      price: 0,
    });
    expect(telemetry.logEvent).not.toHaveBeenCalledWith('currency_spend', expect.anything());
  });

  it('a closed ad counts and spends nothing', async () => {
    const { state, deps, telemetry, finishAd } = await setup({}, 'dismissed');
    const pending = payForCheckpoint(20, 'ad', deps);
    finishAd();
    expect(await pending).toBe('dismissed');
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay);
    expect(telemetry.logEvent).not.toHaveBeenCalled();
  });

  it('an ad that is not ready is unavailable and is not shown', async () => {
    const { state, deps, showRewarded } = await setup({}, 'rewarded', false);
    expect(await payForCheckpoint(20, 'ad', deps)).toBe('unavailable');
    expect(showRewarded).not.toHaveBeenCalled();
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay);
  });

  it('an ad that fails to show is unavailable', async () => {
    const { deps, finishAd } = await setup({}, 'unavailable');
    const pending = payForCheckpoint(20, 'ad', deps);
    finishAd();
    expect(await pending).toBe('unavailable');
  });

  it('refuses once the day limit is used, without showing the ad', async () => {
    const { deps, showRewarded } = await setup({
      checkpointAds: { day: '2026-06-10', used: BALANCE.checkpoints.adsPerDay },
    });
    const state = deps.state;
    expect(state.checkpointAdsLeft).toBe(0);
    expect(await payForCheckpoint(20, 'ad', deps)).toBe('refused');
    expect(showRewarded).not.toHaveBeenCalled();
  });

  it('refuses an ad for the heights that only take berries', async () => {
    const { deps, showRewarded } = await setup();
    expect(await payForCheckpoint(80, 'ad', deps)).toBe('refused');
    expect(await payForCheckpoint(100, 'ad', deps)).toBe('refused');
    expect(showRewarded).not.toHaveBeenCalled();
  });

  it('refuses a locked checkpoint', async () => {
    const { deps, showRewarded } = await setup({ checkpoints: [] });
    expect(await payForCheckpoint(20, 'ad', deps)).toBe('refused');
    expect(showRewarded).not.toHaveBeenCalled();
  });
});

describe('payForCheckpoint taps', () => {
  it('a second tap while the ad shows pays nothing and shows nothing', async () => {
    const { state, deps, showRewarded, finishAd } = await setup();
    const first = payForCheckpoint(20, 'ad', deps);
    expect(await payForCheckpoint(20, 'ad', deps)).toBe('refused');
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('refused');
    finishAd();
    expect(await first).toBe('paid');
    expect(showRewarded).toHaveBeenCalledTimes(1);
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay - 1);
    expect(state.berries).toBe(100);
  });

  it('a double tap on berries pays once', async () => {
    const { state, deps } = await setup();
    const results = await Promise.all([
      payForCheckpoint(40, 'berries', deps),
      payForCheckpoint(40, 'berries', deps),
    ]);
    expect(results).toEqual(['paid', 'refused']);
    expect(state.berries).toBe(100 - PRICE_40);
  });

  it('can pay again after the first payment is done', async () => {
    const { deps } = await setup();
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('paid');
    expect(await payForCheckpoint(40, 'berries', deps)).toBe('paid');
  });
});

describe('logCheckpointOffer', () => {
  it('logs the highest opened checkpoint, 0 when none', async () => {
    const { deps, telemetry } = await setup({ checkpoints: [20, 40] });
    logCheckpointOffer(deps);
    expect(telemetry.logEvent).toHaveBeenCalledWith('checkpoint_offer', { max_height: 40 });
    const none = { state: createTestState(), telemetry: { logEvent: vi.fn() } };
    logCheckpointOffer(none);
    expect(none.telemetry.logEvent).toHaveBeenCalledWith('checkpoint_offer', { max_height: 0 });
  });
});

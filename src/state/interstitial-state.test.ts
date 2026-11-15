import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run-result';
import type { Save } from '../core/save/schema';
import type { GameState } from './game-state';
import { createTestState, loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function run(): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 10,
    score: 100,
    coins: 30,
    berries: 0,
    perfects: 2,
    bestCombo: 3,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 20_000,
    endReason: 'miss',
  };
}

const HOUR = 3_600_000;
const DAY_MS = 24 * HOUR;
const idle = {
  runMs: 20_000,
  rewardedInRun: false,
  newRecord: false,
  levelUp: false,
  newCreature: false,
  shownInSession: 0,
};

/** A state past the first sessions and the first 24 hours, with four finished runs. */
function readyState(clock: { ms: number }): GameState {
  const state = createTestState(clock);
  for (let i = 0; i < 4; i++) state.beginSession();
  for (let i = 0; i < 4; i++) state.recordRun(run());
  clock.ms = T0 + DAY_MS;
  return state;
}

describe('interstitial counters in the game state', () => {
  it('counts one session per launch and never shows in the first three', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    expect(state.data.ads.sessions).toBe(0);
    for (let i = 0; i < 4; i++) state.recordRun(run());
    clock.ms = T0 + DAY_MS;
    for (let n = 1; n <= 3; n++) {
      state.beginSession();
      expect(state.data.ads.sessions).toBe(n);
      expect(state.canShowInterstitial(idle)).toBe(false);
    }
    state.beginSession();
    expect(state.canShowInterstitial(idle)).toBe(true);
  });

  it('stays quiet for 24 hours after the first launch', () => {
    const clock = { ms: T0 };
    const state = readyState(clock);
    clock.ms = T0 + DAY_MS - 1;
    expect(state.canShowInterstitial(idle)).toBe(false);
    clock.ms = T0 + DAY_MS;
    expect(state.canShowInterstitial(idle)).toBe(true);
  });

  it('counts every finished run and starts over after a show', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    for (let i = 0; i < 4; i++) state.beginSession();
    clock.ms = T0 + DAY_MS;
    for (let i = 0; i < 3; i++) state.recordRun(run());
    expect(state.data.ads.runsSinceInterstitial).toBe(3);
    expect(state.canShowInterstitial(idle)).toBe(false);
    state.recordRun(run());
    expect(state.canShowInterstitial(idle)).toBe(true);
    expect(state.canShowInterstitial({ ...idle, rewardedInRun: true })).toBe(false);
    expect(state.canShowInterstitial({ ...idle, newRecord: true })).toBe(false);
    state.noteInterstitialShown();
    expect(state.data.ads).toMatchObject({
      runsSinceInterstitial: 0,
      lastInterstitialAt: T0 + DAY_MS,
    });
    for (let i = 0; i < 4; i++) state.recordRun(run());
    expect(state.canShowInterstitial(idle)).toBe(false);
    clock.ms += 180_000;
    expect(state.canShowInterstitial(idle)).toBe(true);
  });

  it('is off once remove_ads is owned', () => {
    const state = readyState({ ms: T0 });
    state.grantProduct('remove_ads');
    expect(state.canShowInterstitial(idle)).toBe(false);
  });

  it('keeps the daily count across days and a restart, and resets it at local midnight', async () => {
    const clock = { ms: T0 };
    const state = readyState(clock);
    for (let i = 0; i < 12; i++) state.noteInterstitialShown();
    expect(state.data.ads.shownToday).toBe(12);
    clock.ms += 3 * HOUR;
    state.recordRun(run());
    state.recordRun(run());
    state.recordRun(run());
    state.recordRun(run());
    expect(state.canShowInterstitial(idle)).toBe(false);
    const again = await loadTestState(state.data as Save, clock);
    expect(again.data.ads.shownToday).toBe(12);
    expect(again.canShowInterstitial(idle)).toBe(false);
    clock.ms += DAY_MS;
    expect(again.canShowInterstitial(idle)).toBe(true);
    again.noteInterstitialShown();
    expect(again.data.ads.shownToday).toBe(1);
  });

  it('does not reset the daily count when the clock is set back a day', () => {
    const clock = { ms: T0 };
    const state = readyState(clock);
    for (let i = 0; i < 12; i++) state.noteInterstitialShown();
    clock.ms -= DAY_MS;
    expect(state.canShowInterstitial(idle)).toBe(false);
    state.noteInterstitialShown();
    expect(state.data.ads.shownToday).toBe(13);
    expect(state.data.ads.shownDay).not.toBe('');
  });

  it('shows nothing when the clock is set back below the first launch', () => {
    const clock = { ms: T0 };
    const state = readyState(clock);
    clock.ms = T0 - HOUR;
    expect(state.canShowInterstitial(idle)).toBe(false);
  });
});

describe('"No ads" offer in the game state', () => {
  const DAY = 86_400_000;

  it('is due after the second interstitial of the session, once per local day', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    expect(state.removeAdsOfferDue(0)).toBe(false);
    expect(state.removeAdsOfferDue(1)).toBe(false);
    expect(state.removeAdsOfferDue(2)).toBe(true);
    state.noteRemoveAdsOffered();
    expect(state.removeAdsOfferDue(2)).toBe(false);
    expect(state.removeAdsOfferDue(5)).toBe(false);
    clock.ms = T0 + DAY;
    expect(state.removeAdsOfferDue(2)).toBe(true);
  });

  it('is never due once remove_ads is owned', () => {
    const state = createTestState({ ms: T0 });
    state.grantProduct('remove_ads');
    expect(state.removeAdsOfferDue(3)).toBe(false);
  });

  it('survives a reload through the save', async () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.noteRemoveAdsOffered();
    const reloaded = await loadTestState(state.data, clock);
    expect(reloaded.data.ads.offerDay).not.toBe('');
    expect(reloaded.removeAdsOfferDue(2)).toBe(false);
    clock.ms = T0 + DAY;
    expect(reloaded.removeAdsOfferDue(2)).toBe(true);
  });
});

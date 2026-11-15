import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run-result';
import { createTestState } from './test-state';

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

describe('interstitial counters in the game state', () => {
  it('counts one session per launch and never shows in the first one', () => {
    const state = createTestState({ ms: T0 });
    expect(state.data.ads.sessions).toBe(0);
    state.beginSession();
    expect(state.data.ads.sessions).toBe(1);
    for (let i = 0; i < 5; i++) state.recordRun(run());
    expect(state.canShowInterstitial(20_000, false)).toBe(false);
    state.beginSession();
    expect(state.data.ads.sessions).toBe(2);
    expect(state.canShowInterstitial(20_000, false)).toBe(true);
  });

  it('counts every finished run and starts over after a show', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.beginSession();
    state.beginSession();
    state.recordRun(run());
    state.recordRun(run());
    expect(state.data.ads.runsSinceInterstitial).toBe(2);
    expect(state.canShowInterstitial(20_000, false)).toBe(false);
    state.recordRun(run());
    expect(state.canShowInterstitial(20_000, false)).toBe(true);
    expect(state.canShowInterstitial(20_000, true)).toBe(false);
    state.noteInterstitialShown();
    expect(state.data.ads).toMatchObject({ runsSinceInterstitial: 0, lastInterstitialAt: T0 });
    for (let i = 0; i < 3; i++) state.recordRun(run());
    expect(state.canShowInterstitial(20_000, false)).toBe(false);
    clock.ms = T0 + 120_000;
    expect(state.canShowInterstitial(20_000, false)).toBe(true);
  });

  it('is off once remove_ads is owned', () => {
    const state = createTestState({ ms: T0 });
    state.beginSession();
    state.beginSession();
    for (let i = 0; i < 3; i++) state.recordRun(run());
    state.grantProduct('remove_ads');
    expect(state.canShowInterstitial(20_000, false)).toBe(false);
  });
});

// The analytics events the game state sends, seen through a recording service.
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import type { RunResult } from '../core/run/run-result';
import { MemoryStorage } from '../services/storage/memory';
import { MISSIONS } from '../data/progression/missions';
import { localDay } from '../util/calendar';
import { createTestState, loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function recorder() {
  const events: Array<[string, Record<string, string | number | boolean> | undefined]> = [];
  const properties: Array<[string, string]> = [];
  return {
    events,
    properties,
    service: {
      logEvent: (name: string, params?: Record<string, string | number | boolean>) =>
        void events.push([name, params]),
      setUserProperty: (name: string, value: string) => void properties.push([name, value]),
    },
    names: () => events.map(([name]) => name),
    find: (name: string) => events.find(([n]) => n === name)?.[1],
  };
}

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 30,
    score: 100,
    coins: 40,
    berries: 0,
    perfects: 2,
    bestCombo: 3,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 12_000,
    endReason: 'miss',
    ...over,
  };
}

describe('events of the game state', () => {
  it('a finished run tells run_end with its parameters, and the first one ends the tutorial', () => {
    const rec = recorder();
    const state = createTestState({ ms: T0 }, new MemoryStorage(), undefined, rec.service);
    state.recordRun(run(), 0, { floatingCoins: 0, abilities: 2, maxWobble: 0 });
    expect(rec.names()).toContain('run_end');
    expect(rec.find('run_end')).toMatchObject({ mode: 'classic', height: 30, abilities_used: 2 });
    expect(rec.find('tutorial_complete')).toEqual({ height: 30 });
    expect(rec.names()).not.toContain('new_record');
  });

  it('a better height later is a record with the previous best', () => {
    const rec = recorder();
    const state = createTestState({ ms: T0 }, new MemoryStorage(), undefined, rec.service);
    state.recordRun(run({ height: 30 }));
    state.recordRun(run({ height: 55 }));
    expect(rec.find('new_record')).toEqual({ height: 55, prev: 30 });
    expect(rec.events.filter(([name]) => name === 'tutorial_complete')).toHaveLength(1);
  });

  it('claims tell mission_chest, level_up and the large credits', async () => {
    const clock = { ms: T0 };
    const probe = createTestState(clock);
    probe.refreshDay();
    const items = probe.missions.items.map((item) => ({ ...item, progress: item.target }));
    const rec = recorder();
    const state = await loadTestState(
      {
        ...createDefaultSave(T0, 'abc'),
        missions: { day: localDay(T0), items, rerollUsed: false, chestClaimed: false },
      },
      clock,
      undefined,
      rec.service,
    );
    for (const index of [0, 1, 2]) state.claimMission(index);
    state.claimChest();
    expect(rec.names()).toContain('mission_chest');
    const chest = rec.events.find(
      ([name, params]) => name === 'currency_earn' && params?.source === 'chest',
    );
    expect(chest?.[1]).toEqual({
      currency: 'berries',
      amount: MISSIONS.chestBerries,
      source: 'chest',
    });
  });

  it('spendBerries tells currency_spend with the item; a refused payment tells nothing', async () => {
    const rec = recorder();
    const state = await loadTestState(
      { ...createDefaultSave(T0, 'abc'), berries: 20 },
      { ms: T0 },
      undefined,
      rec.service,
    );
    expect(state.spendBerries(5, 'continue')).toBe(true);
    expect(rec.find('currency_spend')).toEqual({
      currency: 'berries',
      amount: 5,
      item: 'continue',
    });
    rec.events.length = 0;
    expect(state.spendBerries(500, 'continue')).toBe(false);
    expect(rec.events).toEqual([]);
  });

  it('the team, the settings, a hint and an interstitial each tell their event', async () => {
    const rec = recorder();
    const state = await loadTestState(
      createDefaultSave(T0, 'abc'),
      { ms: T0 },
      undefined,
      rec.service,
    );
    state.updateSettings({ music: false });
    state.markHint('tap');
    state.markHint('tap');
    state.noteInterstitialShown();
    expect(rec.events).toContainEqual(['settings_change', { key: 'music', value: 0 }]);
    expect(rec.events.filter(([name]) => name === 'tutorial_step')).toEqual([
      ['tutorial_step', { step: 'tap' }],
    ]);
    expect(rec.names()).toContain('ad_interstitial_show');
  });

  it('declining the streak tells streak_lost only when it changed something', async () => {
    const rec = recorder();
    const state = await loadTestState(
      {
        ...createDefaultSave(T0, 'abc'),
        streak: {
          count: 4,
          best: 4,
          lastDay: localDay(T0 - 2 * 86_400_000),
          cycle: 0,
          claimedDay: '',
        },
      },
      { ms: T0 },
      undefined,
      rec.service,
    );
    state.declineStreak();
    expect(rec.find('streak_lost')).toEqual({ count: 4 });
    rec.events.length = 0;
    state.declineStreak();
    expect(rec.names()).not.toContain('streak_lost');
  });

  it('sets the user properties when the save is read and when they change', async () => {
    const rec = recorder();
    const state = await loadTestState(
      createDefaultSave(T0, 'abc'),
      { ms: T0 },
      undefined,
      rec.service,
    );
    expect(rec.properties.map(([name]) => name).sort()).toEqual([
      'baker_level',
      'best_height_bucket',
      'creatures_owned',
      'install_age_bucket',
      'payer',
    ]);
    rec.properties.length = 0;
    state.debugBumpBakerLevel();
    expect(rec.properties).toEqual([['baker_level', '2']]);
  });

  it('a service that throws never reaches the save', () => {
    const boom = vi.fn(() => {
      throw new Error('analytics broke');
    });
    const state = createTestState({ ms: T0 }, new MemoryStorage(), undefined, {
      logEvent: boom,
      setUserProperty: boom,
    });
    expect(() => state.recordRun(run())).not.toThrow();
    expect(state.runsFinished).toBe(1);
  });
});

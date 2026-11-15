import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run-result';
import { xpToNext } from '../core/progression';
import { MS_PER_DAY } from '../data/clock';
import { createDefaultSave } from '../core/save/defaults';
import { DAILY } from '../data/daily';
import { MemoryStorage } from '../services/storage/memory';
import { runCoinCredits, SessionTally } from './session-tally';
import { createTestState, loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
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
    durationMs: 1000,
    endReason: 'miss',
    ...over,
  };
}

function setup() {
  const clock = { ms: T0 };
  const tally = new SessionTally();
  const state = createTestState(clock, new MemoryStorage(), tally);
  return { clock, tally, state };
}

describe('SessionTally', () => {
  it('adds up by source and ignores empty, negative and broken amounts', () => {
    const tally = new SessionTally();
    tally.add('coins', 'gift', 20);
    tally.add('coins', 'gift', 5);
    tally.add('coins', 'mission', 0);
    tally.add('coins', 'mission', -3);
    tally.add('coins', 'mission', Number.NaN);
    expect(tally.snapshot().coins).toEqual({ gift: 25 });
    expect(tally.total('coins')).toBe(25);
    expect(tally.lines()).toContain('session coins 25');
  });

  it('splits run coins by source and keeps the rest as rounding', () => {
    expect(runCoinCredits(20, { floating: 7.9, height: 4, golden: 0 })).toEqual([
      ['floating', 7],
      ['height', 4],
      ['run_other', 9],
    ]);
    expect(runCoinCredits(11, { floating: 7.9, height: 4 })).toEqual([
      ['floating', 7],
      ['height', 4],
    ]);
    expect(runCoinCredits(5, undefined)).toEqual([['run_other', 5]]);
  });
});

describe('the tally in GameState', () => {
  it('counts a run by coin source, its XP and the level rewards separately', () => {
    const { state, tally } = setup();
    let layers = 0;
    for (let level = 1; level < 4; level++) layers += xpToNext(level);
    state.recordRun(run({ height: layers, coins: 30 }), 0, {
      floatingCoins: 0,
      abilities: 0,
      maxWobble: 0,
      coinSources: { floating: 20, height: 10 },
    });
    const totals = tally.snapshot();
    expect(totals.coins.floating).toBe(20);
    expect(totals.coins.height).toBe(10);
    expect(totals.coins.level_reward).toBe(100);
    expect(totals.xp.run_xp).toBe(layers);
    expect(tally.total('coins')).toBe(state.coins);
  });

  it('counts every other source under its own name, and the totals match the wallet', () => {
    const { state, tally, clock } = setup();
    state.claimStreak();
    state.openGift();
    state.addCoins(25, 'gift_double');
    state.addCoins(500, 'ad_double');
    state.addBerries(2);
    state.addBerries(50, 'debug');
    state.claimFreeCoins();
    state.recordRun(run({ height: 1, coins: 0 }));
    clock.ms += MS_PER_DAY;
    state.refreshDay();
    const totals = tally.snapshot();
    expect(totals.coins.streak).toBe(50);
    expect(totals.coins.gift).toBeGreaterThan(0);
    expect(totals.coins.gift_double).toBe(25);
    expect(totals.coins.ad_double).toBe(500);
    expect(totals.coins.shop_free).toBeGreaterThan(0);
    expect(totals.berries.run_berries).toBe(2);
    expect(totals.berries.debug).toBe(50);
    expect(tally.total('coins')).toBe(state.coins);
    expect(tally.total('berries')).toBe(state.berries);
  });

  it('books the daily tiers a run paid under daily_tier, coins and berries', async () => {
    const clock = { ms: T0 };
    const tally = new SessionTally();
    const save = { ...createDefaultSave(T0, 'abc'), bakerLevel: 5 };
    const state = await loadTestState(save, clock, tally);
    const top = DAILY.tiers.reduce((best, tier) => (tier.height > best.height ? tier : best));
    expect(state.startDailyAttempt()).toBe(true);
    state.recordRun(run({ mode: 'daily', height: top.height, coins: 0 }));
    const coins = DAILY.tiers.reduce((sum, tier) => sum + (tier.reward.coins ?? 0), 0);
    const berries = DAILY.tiers.reduce((sum, tier) => sum + (tier.reward.berries ?? 0), 0);
    const totals = tally.snapshot();
    expect(totals.coins.daily_tier).toBe(coins);
    expect(totals.berries.daily_tier).toBe(berries);
    expect(totals.coins.run_other ?? 0).toBe(0);
  });

  it('counts a berry exchange as coins and leaves spending alone', () => {
    const { state, tally } = setup();
    state.addBerries(10, 'debug');
    expect(state.exchangeBerries(10)).toBe(true);
    expect(tally.snapshot().coins.berry_exchange).toBe(state.coins);
    expect(tally.total('berries')).toBe(10);
  });

  it('counts nothing for a refused credit and works without a tally', () => {
    const { state, tally } = setup();
    expect(state.claimMission(0)).toBe(0);
    expect(state.claimChest()).toBe(0);
    expect(tally.total('coins')).toBe(0);
    const plain = createTestState({ ms: T0 });
    plain.addCoins(5);
    expect(plain.coins).toBe(5);
  });

  it('never reaches the save: the same actions give the same save with and without it', () => {
    const { state } = setup();
    const plain = createTestState({ ms: T0 });
    for (const target of [state, plain]) {
      target.addCoins(5, 'debug');
      target.claimStreak();
      target.recordRun(run());
    }
    expect(JSON.stringify(state.data)).toBe(JSON.stringify(plain.data));
  });
});

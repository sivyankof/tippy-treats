import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import type { RunResult } from '../core/run-result';
import { dailySeed } from '../core/daily';
import { MS_PER_DAY } from '../data/clock';
import { DAILY } from '../data/daily';
import { GIFT } from '../data/gift';
import { MISSIONS } from '../data/missions';
import { STREAK } from '../data/streak';
import { localDay, utcDay } from '../util/clock';
import { createTestState, loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function setup() {
  const clock = { ms: T0 };
  return { clock, state: createTestState(clock) };
}

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

describe('streak', () => {
  it('offers day 1 to a new player and pays it once', () => {
    const { state } = setup();
    expect(state.streakEntry()).toMatchObject({ kind: 'claim', position: 1 });
    const claim = state.claimStreak();
    expect(claim?.reward).toEqual({ kind: 'coins', amount: 50 });
    expect(state.coins).toBe(50);
    expect(state.claimStreak()).toBeNull();
    expect(state.streakEntry()).toEqual({ kind: 'none' });
    expect(state.calendar()[0]?.state).toBe('done');
  });

  it('counts a run for the streak once per day', () => {
    const { state, clock } = setup();
    state.recordRun(run());
    state.recordRun(run());
    expect(state.data.streak).toMatchObject({ count: 1, lastDay: localDay(T0) });
    clock.ms += MS_PER_DAY;
    state.recordRun(run());
    expect(state.data.streak.count).toBe(2);
  });

  it('hands out the day 7 creature and reports a compensation for a duplicate', () => {
    const { state, clock } = setup();
    for (let i = 0; i < 6; i++) {
      state.recordRun(run());
      state.claimStreak();
      clock.ms += MS_PER_DAY;
    }
    state.recordRun(run());
    const owned = state.data.creatures.brownie !== undefined;
    const claim = state.claimStreak();
    expect(claim?.position).toBe(7);
    expect(claim?.reward).toEqual({ kind: 'creature', id: 'brownie' });
    expect(claim?.duplicate === null).toBe(!owned);
    expect(state.data.creatures.brownie).toBeDefined();
  });

  describe('a missed day', () => {
    function missed() {
      const ctx = setup();
      ctx.state.recordRun(run());
      ctx.clock.ms += 2 * MS_PER_DAY;
      return ctx;
    }

    it('is a threat that berries forgive', () => {
      const { state } = missed();
      expect(state.streakEntry()).toEqual({ kind: 'threat' });
      state.addBerries(STREAK.restoreBerries + 3);
      expect(state.restoreStreak('berries')).toBe(true);
      expect(state.berries).toBe(3);
      expect(state.streakEntry().kind).toBe('claim');
    });

    it('charges nothing when the berries are short', () => {
      const { state } = missed();
      state.addBerries(STREAK.restoreBerries - 1);
      expect(state.restoreStreak('berries')).toBe(false);
      expect(state.berries).toBe(STREAK.restoreBerries - 1);
      expect(state.streakEntry()).toEqual({ kind: 'threat' });
    });

    it('is forgiven for an ad, which is counted', () => {
      const { state } = missed();
      expect(state.restoreStreak('ad')).toBe(true);
      expect(state.data.stats.adsWatched).toBe(1);
    });

    it('starts over when the player declines', () => {
      const { state } = missed();
      state.declineStreak();
      expect(state.data.streak.count).toBe(0);
      expect(state.data.streak.best).toBe(1);
      expect(state.streakEntry()).toMatchObject({ kind: 'claim', position: 1 });
    });

    it('cannot be restored outside the threat window', () => {
      const { state } = setup();
      expect(state.restoreStreak('ad')).toBe(false);
      expect(state.data.stats.adsWatched).toBe(0);
    });
  });
});

describe('missions', () => {
  it('deals the missions on refresh and keeps them within the day', () => {
    const { state } = setup();
    expect(state.missions.items).toHaveLength(0);
    state.refreshDay();
    const ids = state.missions.items.map((item) => item.id);
    expect(ids).toHaveLength(MISSIONS.groups.length);
    state.refreshDay();
    expect(state.missions.items.map((item) => item.id)).toEqual(ids);
  });

  it('applies a finished run and reports the missions before and after', () => {
    const { state } = setup();
    state.refreshDay();
    const summary = state.recordRun(run(), 0, { floatingCoins: 5, abilities: 1, maxWobble: 10 });
    const sum = (items: readonly { progress: number }[]): number =>
      items.reduce((total, item) => total + item.progress, 0);
    expect(summary.missions.before).toHaveLength(3);
    expect(sum(summary.missions.before)).toBe(0);
    expect(sum(summary.missions.after)).toBeGreaterThan(0);
    expect(state.missions.items).toEqual(summary.missions.after);
  });

  it('deals the missions inside recordRun when no screen did it', () => {
    const { state } = setup();
    expect(state.recordRun(run()).missions.after).toHaveLength(3);
  });

  it('claims a completed mission once, then opens the chest', async () => {
    const clock = { ms: T0 };
    const save = createDefaultSave(T0, 'abc');
    const probe = createTestState(clock);
    probe.refreshDay();
    const items = probe.missions.items.map((item) => ({ ...item, progress: item.target }));
    const state = await loadTestState(
      { ...save, missions: { day: localDay(T0), items, rerollUsed: false, chestClaimed: false } },
      clock,
    );
    expect(state.claimableMissions).toBe(3);
    expect(state.claimChest()).toBe(0);
    const coins = [0, 1, 2].map((index) => state.claimMission(index));
    expect(coins).toEqual(items.map((item) => MISSIONS.reward[item.group]));
    expect(state.claimMission(0)).toBe(0);
    expect(state.coins).toBe(coins.reduce((a, b) => a + b, 0));
    expect(state.claimableMissions).toBe(0);
    expect(state.claimChest()).toBe(MISSIONS.chestBerries);
    expect(state.berries).toBe(MISSIONS.chestBerries);
    expect(state.claimChest()).toBe(0);
  });

  it('rerolls an open mission once a day', () => {
    const { state } = setup();
    state.refreshDay();
    expect(state.rerollMission(0)).toBe(true);
    expect(state.missions.rerollUsed).toBe(true);
    expect(state.rerollMission(1)).toBe(false);
  });

  it('deals a fresh list on the next day', () => {
    const { state, clock } = setup();
    state.refreshDay();
    clock.ms += MS_PER_DAY;
    state.refreshDay();
    expect(state.missions.day).toBe(localDay(clock.ms));
    expect(state.missions.rerollUsed).toBe(false);
  });
});

describe('daily tower', () => {
  async function unlocked(clock: { ms: number }) {
    const save = { ...createDefaultSave(T0, 'abc'), bakerLevel: 5 };
    return loadTestState(save, clock);
  }

  it('stays locked below the unlock level', () => {
    const { state } = setup();
    expect(state.dailyInfo().unlocked).toBe(false);
    expect(state.startDailyAttempt()).toBe(false);
  });

  it('reports the day, the seed and the team of the UTC day', async () => {
    const state = await unlocked({ ms: T0 });
    const info = state.dailyInfo();
    expect(info).toMatchObject({
      unlocked: true,
      day: utcDay(T0),
      seed: dailySeed(utcDay(T0)),
      attemptsLeft: DAILY.attempts,
      canAddAttempt: true,
      best: 0,
      claimedTiers: [],
    });
    expect(info.team).toHaveLength(DAILY.teamSize);
  });

  it('spends attempts and adds one for an ad, once a day', async () => {
    const state = await unlocked({ ms: T0 });
    for (let i = 0; i < DAILY.attempts; i++) expect(state.startDailyAttempt()).toBe(true);
    expect(state.startDailyAttempt()).toBe(false);
    expect(state.addDailyAttempt()).toBe(true);
    expect(state.data.stats.adsWatched).toBe(1);
    expect(state.addDailyAttempt()).toBe(false);
    expect(state.dailyInfo().attemptsLeft).toBe(DAILY.extraAttempts);
    expect(state.startDailyAttempt()).toBe(true);
  });

  it('pays the tiers a daily run reaches once, and counts the daily mission', async () => {
    const state = await unlocked({ ms: T0 });
    const first = DAILY.tiers[0];
    const second = DAILY.tiers[1];
    if (!first || !second) throw new Error('daily tiers are missing');
    expect(state.startDailyAttempt()).toBe(true);
    const summary = state.recordRun(run({ mode: 'daily', height: first.height, coins: 0 }));
    expect(summary.dailyTiers.map((tier) => tier.height)).toEqual([first.height]);
    expect(state.coins).toBe(first.reward.coins);
    expect(state.dailyInfo().best).toBe(first.height);
    expect(
      state.recordRun(run({ mode: 'daily', height: first.height, coins: 0 })).dailyTiers,
    ).toEqual([]);
    const again = state.recordRun(run({ mode: 'daily', height: second.height, coins: 0 }));
    expect(again.dailyTiers.map((tier) => tier.height)).toEqual([second.height]);
    expect(state.dailyInfo().claimedTiers).toEqual([first.height, second.height]);
  });

  it('pays nothing for a run that began on another UTC day', async () => {
    const clock = { ms: T0 };
    const state = await unlocked(clock);
    expect(state.startDailyAttempt()).toBe(true);
    clock.ms += MS_PER_DAY;
    const summary = state.recordRun(run({ mode: 'daily', height: 100, coins: 0 }));
    expect(summary.dailyTiers).toEqual([]);
    expect(state.dailyInfo().best).toBe(0);
  });

  it('does not touch the daily slice for a classic run', async () => {
    const state = await unlocked({ ms: T0 });
    expect(state.recordRun(run({ height: 100 })).dailyTiers).toEqual([]);
    expect(state.dailyInfo().best).toBe(0);
  });
});

describe('gift', () => {
  it('is ready on a new save, pays within the range and waits for the interval', () => {
    const { state, clock } = setup();
    expect(state.giftReady).toBe(true);
    const coins = state.openGift();
    expect(coins).toBeGreaterThanOrEqual(GIFT.minCoins);
    expect(coins).toBeLessThanOrEqual(GIFT.maxCoins);
    expect(state.coins).toBe(coins);
    expect(state.giftReady).toBe(false);
    expect(state.openGift()).toBeNull();
    expect(state.msUntilGift).toBe(GIFT.intervalMs);
    clock.ms += GIFT.intervalMs;
    expect(state.giftReady).toBe(true);
  });
});

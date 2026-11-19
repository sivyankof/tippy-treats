// The economy rules as the game state applies them: the oven, mission XP, the x2 limit and the
// record way of the twins.
import { describe, expect, it } from 'vitest';
import { xpToNext } from '../core/progression/progression';
import type { RunResult } from '../core/run/run-result';
import { MS_PER_DAY } from '../data/app/clock';
import { MISSIONS } from '../data/progression/missions';
import { OVEN } from '../data/progression/progression';
import { REWARDED_OFFERS } from '../data/economy/rewarded-video';
import { createTestState } from './test-state';

const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 10,
    score: 100,
    coins: 0,
    berries: 0,
    perfects: 0,
    continuesUsed: 0,
    bestCombo: 0,
    zoneIndex: 0,
    durationMs: 1000,
    endReason: 'miss',
    ...over,
  };
}

describe('the fresh oven in a run', () => {
  it('pays 1 XP per layer, then 1 per 6, and says when a run emptied the oven', () => {
    const state = createTestState({ ms: T0 });
    const first = state.recordRun(run({ height: OVEN.freshLayers - 100 }));
    expect(first.xpGained).toBe(OVEN.freshLayers - 100);
    expect(first.oven).toEqual({ fresh: OVEN.freshLayers - 100, left: 100, ranOut: false });
    const second = state.recordRun(run({ height: 160 }));
    // 100 fresh layers + 60 layers at 1 per 6.
    expect(second.xpGained).toBe(110);
    expect(second.oven).toEqual({ fresh: 100, left: 0, ranOut: true });
    const third = state.recordRun(run({ height: 12 }));
    expect(third.xpGained).toBe(2);
    expect(third.oven).toEqual({ fresh: 0, left: 0, ranOut: false });
    expect(state.ovenLeft).toBe(0);
  });

  it('counts the layers of a daily run into the same oven bar', () => {
    const state = createTestState({ ms: T0 });
    const summary = state.recordRun(run({ mode: 'daily', height: 40 }));
    expect(summary.xpGained).toBe(40);
    expect(summary.oven).toEqual({ fresh: 40, left: OVEN.freshLayers - 40, ranOut: false });
    expect(state.ovenLeft).toBe(OVEN.freshLayers - 40);
  });

  it('counts the layers of the run, not the XP, in the stats', () => {
    const state = createTestState({ ms: T0 });
    state.recordRun(run({ height: OVEN.freshLayers + 60 }));
    expect(state.data.stats.totalLayers).toBe(OVEN.freshLayers + 60);
  });

  it('refills the oven on the next local day', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.recordRun(run({ height: OVEN.freshLayers }));
    expect(state.ovenLeft).toBe(0);
    clock.ms += MS_PER_DAY;
    expect(state.ovenLeft).toBe(OVEN.freshLayers);
    expect(state.recordRun(run({ height: 40 })).xpGained).toBe(40);
  });

  it('does not refill the oven when the day goes back', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.recordRun(run({ height: OVEN.freshLayers }));
    clock.ms -= MS_PER_DAY;
    expect(state.ovenLeft).toBe(0);
    expect(state.recordRun(run({ height: 12 })).xpGained).toBe(2);
  });
});

describe('XP of missions', () => {
  it('pays the XP of the group with the coins when a mission is claimed', () => {
    const state = createTestState({ ms: T0 });
    state.refreshDay();
    const extras = { floatingCoins: 100, abilities: 10, maxWobble: 0 };
    const big = { height: 200, score: 9000, perfects: 40, bestCombo: 40, coins: 1000 };
    for (let i = 0; i < 6; i++) state.recordRun(run(big), 0, extras);
    state.recordRun(run({ ...big, mode: 'daily' }), 0, extras);
    const before = { level: state.data.bakerLevel, xp: state.data.bakerXp };
    const groups = state.missions.items.map((item) => item.group);
    let expected = 0;
    state.missions.items.forEach((_, index) => {
      const claim = state.claimMission(index);
      expect(claim?.xp).toBe(MISSIONS.xp[groups[index] ?? 'easy']);
      expected += claim?.xp ?? 0;
    });
    expect(expected).toBeGreaterThan(0);
    const after = { level: state.data.bakerLevel, xp: state.data.bakerXp };
    let gained = after.xp - before.xp;
    for (let l = before.level; l < after.level; l += 1) gained += xpToNext(l);
    expect(gained).toBe(expected);
    expect(state.claimMission(0)).toBeNull();
  });
});

describe('x2 coins per day', () => {
  it('pays the doubled coins until the limit and not after it', () => {
    const state = createTestState({ ms: T0 });
    for (let i = 0; i < REWARDED_OFFERS.doubleCoinsPerDay; i += 1) {
      expect(state.claimDoubleCoins(10)).toBe(true);
    }
    expect(state.coins).toBe(10 * REWARDED_OFFERS.doubleCoinsPerDay);
    expect(state.doublesLeft).toBe(0);
    expect(state.claimDoubleCoins(10)).toBe(false);
    expect(state.coins).toBe(10 * REWARDED_OFFERS.doubleCoinsPerDay);
  });

  it('starts over the next day', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    for (let i = 0; i < REWARDED_OFFERS.doubleCoinsPerDay; i += 1) state.claimDoubleCoins(1);
    clock.ms += MS_PER_DAY;
    expect(state.doublesLeft).toBe(REWARDED_OFFERS.doubleCoinsPerDay);
  });
});

describe('the twins by record', () => {
  it('hands the twins over when the best height reaches 75, once', () => {
    const state = createTestState({ ms: T0 });
    state.recordRun(run({ height: 10 }));
    const summary = state.recordRun(run({ height: 75 }));
    expect(summary.recordCreatures).toEqual(['twins']);
    expect(state.data.creatures.twins).toEqual({ level: 1 });
    expect(state.recordRun(run({ height: 80 })).recordCreatures).toEqual([]);
  });

  it('does not give them for a daily run or a lower height', () => {
    const state = createTestState({ ms: T0 });
    expect(state.recordRun(run({ height: 74 })).recordCreatures).toEqual([]);
    expect(state.recordRun(run({ mode: 'daily', height: 90 })).recordCreatures).toEqual([]);
    expect(state.data.creatures.twins).toBeUndefined();
  });
});

// Every reward of the game is paid once: level-ups, the ad double of the results, the streak
// calendar, missions, the chest, the gift, the shop and the day change.
import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/run/run-result';
import { xpToNext } from '../core/progression/progression';
import { MS_PER_DAY } from '../data/app/clock';
import { BERRY_PACKS } from '../data/economy/economy';
import { GIFT } from '../data/economy/gift';
import { LEVEL_REWARDS } from '../data/progression/progression';
import { SHOP } from '../data/economy/shop';
import { MemoryStorage } from '../services/storage/memory';
import type { RunSummary } from './game-state';
import { createTestState, layersForXp } from './test-state';

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

/** Coins and berries the level-ups of a run paid, so a test can tell them from other credits. */
function levelCoins(summary: RunSummary): number {
  return summary.levelUps.reduce((sum, up) => sum + (up.reward.coins ?? 0), 0);
}

function levelBerries(summary: RunSummary): number {
  return summary.levelUps.reduce((sum, up) => sum + (up.reward.berries ?? 0), 0);
}

/** Layers it takes to go from the start of level 1 to the start of `level`. */
function layersTo(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return layersForXp(total);
}

describe('level rewards', () => {
  it('pays a level once: a later run that stays on the level pays nothing more', () => {
    const state = createTestState({ ms: T0 });
    const reward = LEVEL_REWARDS[4];
    const first = state.recordRun(run({ height: layersTo(4), coins: 0 }));
    expect(first.levelUps.map((up) => up.level)).toEqual([2, 3, 4]);
    expect(state.coins).toBe(reward?.coins);
    const again = state.recordRun(run({ height: 1, coins: 0 }));
    expect(again.levelUps).toEqual([]);
    expect(state.coins).toBe(reward?.coins);
  });

  it('pays every level of a big run once, and never the same level again after a reload', async () => {
    const clock = { ms: T0 };
    const storage = new MemoryStorage();
    const state = createTestState(clock, storage);
    await state.load();
    const summary = state.recordRun(run({ height: layersTo(15), coins: 0 }));
    expect(summary.levelUps.map((up) => up.level)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 2),
    );
    const expectedCoins = summary.levelUps.reduce((sum, up) => sum + (up.reward.coins ?? 0), 0);
    // The tall tower also reaches new Space laps: those berries are paid once, with the levels.
    const levelBerries = summary.levelUps.reduce((sum, up) => sum + (up.reward.berries ?? 0), 0);
    const expectedBerries = levelBerries + summary.lapBerries;
    expect(state.coins).toBe(expectedCoins);
    expect(state.berries).toBe(expectedBerries);
    expect(state.data.bakerLevel).toBe(15);
    state.flush();

    const reloaded = createTestState(clock, storage);
    await reloaded.load();
    expect(reloaded.coins).toBe(expectedCoins);
    expect(reloaded.berries).toBe(expectedBerries);
    const next = reloaded.recordRun(run({ height: 2, coins: 0 }));
    expect(next.levelUps).toEqual([]);
    expect(reloaded.coins).toBe(expectedCoins);
  });

  it('counts XP once per layer of the run, not again for the ad double of the results', () => {
    const state = createTestState({ ms: T0 });
    const summary = state.recordRun(run({ height: 12, coins: 40 }));
    const xp = state.data.bakerXp;
    const layers = state.data.stats.totalLayers;
    // The "x2 coins" ad pays the run's coins once more and nothing else.
    state.addCoins(40);
    state.countAdWatched();
    expect(state.coins).toBe(80);
    expect(state.data.bakerXp).toBe(xp);
    expect(state.data.bakerLevel).toBe(summary.before.level);
    expect(state.data.stats.totalLayers).toBe(layers);
    expect(state.data.stats.runs).toBe(1);
  });
});

describe('streak calendar', () => {
  it('pays today once, again only on a later day, and only after a run on that day', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    expect(state.claimStreak()?.position).toBe(1);
    const coins = state.coins;
    expect(state.claimStreak()).toBeNull();
    expect(state.coins).toBe(coins);
    state.recordRun(run({ coins: 0 }));
    // The day changes while the player stays on Home: the next cell is on offer exactly once.
    clock.ms += MS_PER_DAY;
    state.refreshDay();
    expect(state.claimStreak()?.position).toBe(2);
    expect(state.claimStreak()).toBeNull();
  });

  it('does not pay a cell on a day that has not come: a clock set back changes nothing', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.claimStreak();
    const coins = state.coins;
    clock.ms -= 3 * MS_PER_DAY;
    expect(state.claimStreak()).toBeNull();
    expect(state.coins).toBe(coins);
  });

  it('a run is counted for the streak once per day, however many runs end', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    for (let i = 0; i < 5; i++) state.recordRun(run());
    expect(state.data.streak.count).toBe(1);
    clock.ms += MS_PER_DAY;
    for (let i = 0; i < 5; i++) state.recordRun(run());
    expect(state.data.streak.count).toBe(2);
  });
});

describe('missions and the chest', () => {
  /** Completes every mission with big runs, then returns the missions of the day. */
  function completeAll(state: ReturnType<typeof createTestState>): void {
    state.refreshDay();
    const extras = { floatingCoins: 100, abilities: 10, maxWobble: 0, flies: 0 };
    const big = { height: 200, score: 9000, perfects: 40, bestCombo: 40, coins: 1000 };
    for (let i = 0; i < 6; i++) state.recordRun(run(big), 0, extras);
    state.recordRun(run({ ...big, mode: 'daily' }), 0, extras);
  }

  it('pays a mission once and the chest once, whatever the order and the repeats', () => {
    const state = createTestState({ ms: T0 });
    completeAll(state);
    const count = state.missions.items.length;
    expect(state.claimableMissions).toBe(count);
    let paid = 0;
    for (let i = 0; i < count; i++) paid += state.claimMission(i)?.coins ?? 0;
    expect(paid).toBeGreaterThan(0);
    const coins = state.coins;
    for (let i = 0; i < count; i++) expect(state.claimMission(i)).toBeNull();
    expect(state.coins).toBe(coins);
    const berries = state.berries;
    const chest = state.claimChest();
    expect(chest).toBeGreaterThan(0);
    expect(state.berries).toBe(berries + chest);
    expect(state.claimChest()).toBe(0);
    expect(state.berries).toBe(berries + chest);
  });

  it('keeps a claimed mission claimed when the screen asks for the day again', () => {
    const state = createTestState({ ms: T0 });
    completeAll(state);
    state.claimMission(0);
    const coins = state.coins;
    state.refreshDay();
    state.refreshDay();
    expect(state.claimMission(0)).toBeNull();
    expect(state.coins).toBe(coins);
  });

  it('a new day deals new missions and chest: yesterday never pays a second time', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    completeAll(state);
    for (let i = 0; i < state.missions.items.length; i++) state.claimMission(i);
    state.claimChest();
    const wallet = { coins: state.coins, berries: state.berries };
    clock.ms += MS_PER_DAY;
    // On the results screen the run itself deals the new day first, then counts for it.
    const summary = state.recordRun(run({ height: 1, coins: 0 }));
    expect(state.missions.items.every((item) => !item.claimed)).toBe(true);
    expect(state.claimChest()).toBe(0);
    expect(state.coins).toBe(wallet.coins + levelCoins(summary));
    expect(state.berries).toBe(wallet.berries + levelBerries(summary));
  });

  it('a clock moved back (a negative ?dayOffset) does not deal yesterday again', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    completeAll(state);
    for (let i = 0; i < state.missions.items.length; i++) state.claimMission(i);
    state.claimChest();
    const wallet = { coins: state.coins, berries: state.berries };
    clock.ms -= 2 * MS_PER_DAY;
    state.refreshDay();
    expect(state.claimableMissions).toBe(0);
    for (let i = 0; i < state.missions.items.length; i++) expect(state.claimMission(i)).toBeNull();
    expect(state.claimChest()).toBe(0);
    expect({ coins: state.coins, berries: state.berries }).toEqual(wallet);
  });
});

describe('gift', () => {
  it('pays once per interval; the ad double is a separate payment of the same amount', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    const coins = state.openGift();
    expect(coins).not.toBeNull();
    expect(coins ?? 0).toBeGreaterThanOrEqual(GIFT.minCoins);
    expect(state.coins).toBe(coins);
    expect(state.openGift()).toBeNull();
    expect(state.coins).toBe(coins);
    state.addCoins(coins ?? 0);
    expect(state.coins).toBe((coins ?? 0) * 2);
    // A reopened window finds the box closed.
    expect(state.giftReady).toBe(false);
    clock.ms += GIFT.intervalMs;
    expect(state.giftReady).toBe(true);
    expect(state.openGift()).not.toBeNull();
    expect(state.openGift()).toBeNull();
  });

  it('is not ready again when the clock is moved back', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.openGift();
    const coins = state.coins;
    clock.ms -= MS_PER_DAY;
    expect(state.openGift()).toBeNull();
    expect(state.coins).toBe(coins);
  });
});

describe('shop', () => {
  it('pays the free coins only as often as the day allows', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    for (let i = 0; i < SHOP.freeCoins.perDay; i++) expect(state.claimFreeCoins()).toBe(true);
    expect(state.claimFreeCoins()).toBe(false);
    expect(state.coins).toBe(SHOP.freeCoins.amount * SHOP.freeCoins.perDay);
    clock.ms += MS_PER_DAY;
    expect(state.claimFreeCoins()).toBe(true);
  });

  it('a berry exchange takes the berries and pays the coins once', () => {
    const state = createTestState({ ms: T0 });
    const pack = BERRY_PACKS[0];
    if (!pack) throw new Error('no packs');
    state.addBerries(pack.berries);
    expect(state.exchangeBerries(pack.berries)).toBe(true);
    expect(state.berries).toBe(0);
    expect(state.coins).toBe(pack.coins);
    expect(state.exchangeBerries(pack.berries)).toBe(false);
    expect(state.coins).toBe(pack.coins);
  });
});

describe('daily tower across the day change', () => {
  it('pays the tiers of a run once; a run that crossed midnight pays nothing; the new day pays anew', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.recordRun(run({ height: layersTo(5), coins: 0 }));
    expect(state.startDailyAttempt()).toBe(true);
    const summary = state.recordRun(run({ mode: 'daily', height: 40, coins: 0 }));
    const tiers = summary.dailyTiers.length;
    expect(tiers).toBeGreaterThan(0);
    expect(summary.dailyStale).toBe(false);
    const wallet = { coins: state.coins, berries: state.berries };
    const repeat = state.recordRun(run({ mode: 'daily', height: 40, coins: 0 }));
    expect(repeat.dailyTiers).toEqual([]);
    expect(state.coins).toBe(wallet.coins + levelCoins(repeat));
    expect(state.berries).toBe(wallet.berries + levelBerries(repeat));

    // An attempt began today and ends after midnight UTC: nothing is paid.
    expect(state.startDailyAttempt()).toBe(true);
    clock.ms += MS_PER_DAY;
    const late = state.recordRun(run({ mode: 'daily', height: 100, coins: 0 }));
    expect(late.dailyTiers).toEqual([]);
    // The results say the tower changed instead of showing the tier and the new day's progress.
    expect(late.dailyStale).toBe(true);
    expect(state.coins).toBe(wallet.coins + levelCoins(repeat) + levelCoins(late));

    // On the new day the tiers are open again.
    expect(state.startDailyAttempt()).toBe(true);
    expect(state.recordRun(run({ mode: 'daily', height: 40, coins: 0 })).dailyTiers).toHaveLength(
      tiers,
    );
  });

  it('does not say the tower changed when the clock was only set back', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    state.recordRun(run({ height: layersTo(5), coins: 0 }));
    expect(state.startDailyAttempt()).toBe(true);
    state.recordRun(run({ mode: 'daily', height: 20, coins: 0 }));
    clock.ms -= MS_PER_DAY;
    expect(state.startDailyAttempt()).toBe(true);
    const back = state.recordRun(run({ mode: 'daily', height: 40, coins: 0 }));
    expect(back.dailyStale).toBe(false);
  });
});

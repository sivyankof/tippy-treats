import { describe, expect, it } from 'vitest';
import { berriesFromEvents } from '../core/berries';
import { TimingBot } from '../core/bot';
import { Rng } from '../core/rng';
import type { RunMode, RunResult } from '../core/run-result';
import { TowerSim } from '../core/tower-sim';
import { DAILY } from '../data/daily';
import { STORAGE_KEYS } from '../data/storage';
import { MemoryStorage } from '../services/storage/memory';
import { bindPageLeave } from '../state/page-lifecycle';
import { createTestState, layersForXp } from '../state/test-state';
import type { GameState } from '../state/game-state';
import { parseDebugParams, savesRun } from '../util/debug-params';
import { ContinueFlow } from './continue-flow';
import { buildResultsData } from './results-data';
import { exitTarget } from './run-exit';
import { RunRecorder } from './run-recorder';
import { CLASSIC_RUN, DAILY_RUN } from './run-request';
import { decideRestart } from './run-restart';
import { SCENES } from './scene-keys';
import { emptyTally } from '../core/run-tally';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);
const STEP_MS = 16;

/**
 * One run as the game scene drives it: a bot plays the sim, berries go to the wallet the moment
 * they are earned and the recorder gets every event, exactly as `GameScene.update` does.
 */
class PlayedRun {
  readonly sim: TowerSim;
  readonly recorder: RunRecorder;
  private readonly bot: TimingBot;
  /** Berries this run credited to the wallet while it ran. */
  berriesPaid = 0;
  lastResult: RunResult | null = null;

  constructor(
    private readonly state: GameState,
    opts: {
      mode?: RunMode;
      seed?: number;
      startHeight?: number;
      writesSave?: boolean;
      /** Timing deviation of the bot: a large one makes it miss soon. */
      sd?: number;
    } = {},
  ) {
    const seed = opts.seed ?? 7;
    this.writesSave = opts.writesSave ?? true;
    this.sim = new TowerSim({
      seed,
      mode: opts.mode ?? 'classic',
      team: [null, null, null],
      tutorial: false,
      startHeight: opts.startHeight ?? 0,
    });
    this.bot = new TimingBot(opts.sd ?? 8, new Rng(seed).fork('bot'));
    this.recorder = new RunRecorder(state, opts.startHeight ?? 0, this.writesSave);
  }

  private readonly writesSave: boolean;

  /** One frame. */
  step(): void {
    const events = this.sim.update(STEP_MS);
    this.bot.observe(events);
    if (this.bot.shouldDrop(this.sim)) events.push(...this.sim.drop());
    this.feed(events);
  }

  /** Hands the events of a step to the wallet and the recorder, as the scene does. */
  feed(events: ReturnType<TowerSim['update']>): void {
    const berries = berriesFromEvents(events);
    if (this.writesSave) {
      this.state.addBerries(berries);
      this.berriesPaid += berries;
    }
    this.recorder.recordFinished(events);
    for (const event of events) if (event.type === 'run_over') this.lastResult = event.result;
  }

  /** Plays until `phase` is reached; fails the test when it never comes. */
  playUntil(phase: 'await_continue' | 'over', maxSteps = 200_000): void {
    for (let i = 0; i < maxSteps; i++) {
      if (this.sim.state.phase === phase) return;
      if (this.sim.state.phase === 'over') throw new Error('the run ended before the phase');
      this.step();
    }
    throw new Error(`the run never reached ${phase}`);
  }

  /** The player declines the offer: the run ends. */
  decline(): void {
    this.feed(this.sim.decline());
  }

  /** The player continues: the missed layer comes back. */
  continueRun(): void {
    this.feed(this.sim.continueRun());
  }

  /** Plays on until at least `layers` layers stand, without letting the run end. */
  playLayers(layers: number): void {
    for (let i = 0; i < 200_000 && this.sim.state.height < layers; i++) {
      if (this.sim.state.phase === 'await_continue' || this.sim.state.phase === 'over') break;
      this.step();
    }
  }
}

function loadedWith(storage: MemoryStorage, clock: { ms: number }): Promise<GameState> {
  const state = createTestState(clock, storage);
  return state.load().then(() => state);
}

describe('a run is credited once', () => {
  it('a run that ends by itself: coins once, XP once, berries once', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state, { sd: 40 });
    run.playUntil('await_continue');
    run.decline();
    const result = run.lastResult;
    if (!result) throw new Error('no result');
    expect(state.coins).toBe(Math.floor(result.coins));
    expect(state.berries).toBe(run.berriesPaid);
    expect(state.data.stats.runs).toBe(1);
    expect(run.recorder.summary?.xpGained).toBe(result.height);
    // Whatever else reaches the recorder afterwards (shutdown of the scene, a page leave) is a no-op.
    run.recorder.recordQuit(run.sim);
    run.recorder.recordOver(result);
    expect(state.coins).toBe(Math.floor(result.coins));
    expect(state.data.stats.runs).toBe(1);
  });

  it('a miss that is continued and a run that ends later are recorded once, at the real end', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state, { sd: 60 });
    run.playUntil('await_continue');
    // The miss alone changed nothing in the wallet: the run is not over.
    expect(state.coins).toBe(0);
    expect(state.data.stats.runs).toBe(0);
    expect(run.recorder.summary).toBeNull();
    run.continueRun();
    expect(state.data.stats.runs).toBe(0);
    run.playUntil('await_continue');
    run.decline();
    const result = run.lastResult;
    if (!result) throw new Error('no result');
    expect(result.continuesUsed).toBe(1);
    expect(state.data.stats.runs).toBe(1);
    expect(state.coins).toBe(Math.floor(result.coins));
    expect(run.recorder.summary?.xpGained).toBe(result.height);
  });

  it('a berry continue costs berries and credits nothing', () => {
    const state = createTestState({ ms: T0 });
    state.addBerries(50);
    const flow = new ContinueFlow({
      ads: { isRewardedReady: () => false, showRewarded: () => Promise.resolve('unavailable') },
      wallet: state,
      // A player past the clean first runs, so the window opens.
      player: { runsFinished: 3 },
    });
    expect(flow.open('classic', 0)).toBe(true);
    const before = { coins: state.coins, berries: state.berries };
    expect(flow.payWithBerries()).toBe(true);
    expect(state.coins).toBe(before.coins);
    expect(state.berries).toBeLessThan(before.berries);
    // The payment is taken once: a second press is refused while the decision is pending.
    const afterPayment = state.berries;
    expect(flow.payWithBerries()).toBe(false);
    expect(state.berries).toBe(afterPayment);
  });

  it('an ad continue credits nothing (the ad is only counted by showRewarded)', async () => {
    const state = createTestState({ ms: T0 });
    const flow = new ContinueFlow({
      ads: { isRewardedReady: () => true, showRewarded: () => Promise.resolve('rewarded') },
      wallet: state,
      // A player past the clean first runs, so the window opens.
      player: { runsFinished: 3 },
    });
    expect(flow.open('classic', 0)).toBe(true);
    await flow.watchAd();
    expect(flow.takeAction()).toBe('continue');
    expect(state.coins).toBe(0);
    expect(state.berries).toBe(0);
    expect(state.data.stats.runs).toBe(0);
  });

  it('restart from the pause records the abandoned run once and the new one separately', () => {
    const state = createTestState({ ms: T0 });
    const first = new PlayedRun(state, { seed: 3 });
    first.playLayers(5);
    expect(state.data.stats.runs).toBe(0);
    // The scene shuts down on the restart: the run is a quit.
    first.recorder.recordQuit(first.sim);
    const quit = first.recorder.summary;
    expect(quit).not.toBeNull();
    const quitCoins = state.coins;
    expect(state.data.stats.runs).toBe(1);
    // A second shutdown signal for the same scene changes nothing.
    first.recorder.recordQuit(first.sim);
    expect(state.data.stats.runs).toBe(1);
    expect(state.coins).toBe(quitCoins);
    // The new run has its own recorder and is counted as another run.
    const second = new PlayedRun(state, { seed: 4, sd: 40 });
    second.playUntil('await_continue');
    second.decline();
    expect(state.data.stats.runs).toBe(2);
    expect(state.coins).toBe(quitCoins + Math.floor(second.lastResult?.coins ?? -1));
  });

  it('"Home" from the pause records the run once and leaves through the recorded summary', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state, { seed: 5 });
    run.playLayers(6);
    // `leaveRun` records the quit, then the shutdown of the scene records it again.
    run.recorder.recordQuit(run.sim);
    const coins = state.coins;
    const xp = state.data.bakerXp;
    const stats = state.data.stats.runs;
    run.recorder.recordQuit(run.sim);
    expect(exitTarget(CLASSIC_RUN, run.recorder.summary).key).toBeOneOf([
      SCENES.home,
      SCENES.newCreature,
    ]);
    expect(state.coins).toBe(coins);
    expect(state.data.bakerXp).toBe(xp);
    expect(state.data.stats.runs).toBe(stats);
    expect(stats).toBe(1);
  });

  it('a run that earned nothing before the quit is not counted at all', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state);
    run.recorder.recordQuit(run.sim);
    expect(state.data.stats.runs).toBe(0);
    expect(run.recorder.summary).toBeNull();
  });
});

describe('page reload and tab close', () => {
  it('closing the tab mid-run keeps the coins once, whatever the shutdown does after', async () => {
    const clock = { ms: T0 };
    const storage = new MemoryStorage();
    const state = await loadedWith(storage, clock);
    const run = new PlayedRun(state, { seed: 9 });
    run.playLayers(7);
    const win = new EventTarget();
    bindPageLeave(
      () => {
        run.recorder.recordQuit(run.sim);
        state.flush();
      },
      () => undefined,
      win as unknown as Window,
    );
    win.dispatchEvent(new Event('pagehide'));
    // Some browsers fire pagehide twice or the scene still shuts down: still one run.
    win.dispatchEvent(new Event('pagehide'));
    run.recorder.recordQuit(run.sim);
    state.flush();
    const saved = { coins: state.coins, runs: state.data.stats.runs, xp: state.data.bakerXp };
    expect(saved.runs).toBe(1);
    expect(await storage.get(STORAGE_KEYS.save)).not.toBeNull();

    // The reload reads the save; nothing is recorded again.
    const reloaded = await loadedWith(storage, clock);
    expect(reloaded.coins).toBe(saved.coins);
    expect(reloaded.data.stats.runs).toBe(1);
    expect(reloaded.data.bakerXp).toBe(saved.xp);
  });

  it('a reload on the results screen finds the run recorded once (it was recorded at its end)', async () => {
    const clock = { ms: T0 };
    const storage = new MemoryStorage();
    const state = await loadedWith(storage, clock);
    const run = new PlayedRun(state, { sd: 40 });
    run.playUntil('await_continue');
    run.decline();
    const coins = state.coins;
    // pagehide on the results screen: the recorder is already done.
    run.recorder.recordQuit(run.sim);
    state.flush();
    const reloaded = await loadedWith(storage, clock);
    expect(reloaded.coins).toBe(coins);
    expect(reloaded.data.stats.runs).toBe(1);
  });

  it('a page that comes back from the cache starts a fresh run, the old one stays recorded once', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state, { seed: 11 });
    run.playLayers(5);
    const win = new EventTarget();
    let restored = 0;
    bindPageLeave(
      () => run.recorder.recordQuit(run.sim),
      () => {
        restored += 1;
      },
      win as unknown as Window,
    );
    win.dispatchEvent(new Event('pagehide'));
    const coins = state.coins;
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(restored).toBe(1);
    expect(state.coins).toBe(coins);
    expect(state.data.stats.runs).toBe(1);
  });
});

describe('daily tower runs', () => {
  const T_DAILY = Date.UTC(2026, 5, 10, 12, 0, 0);

  async function unlocked(clock: { ms: number }): Promise<GameState> {
    const state = createTestState(clock);
    // Baker level 5 opens the tower: 150 + 250 + 400 + 600 XP.
    await Promise.resolve();
    state.recordRun(fakeResult({ height: layersForXp(1400), coins: 0 }));
    return state;
  }

  function fakeResult(over: Partial<RunResult>): RunResult {
    return {
      seed: 1,
      mode: 'classic',
      height: 10,
      score: 100,
      coins: 0,
      berries: 0,
      perfects: 0,
      bestCombo: 0,
      continuesUsed: 0,
      zoneIndex: 0,
      durationMs: 1000,
      endReason: 'miss',
      ...over,
    };
  }

  it('pays each tier once, even when the same daily run is quit, restarted and played again', async () => {
    const clock = { ms: T_DAILY };
    const state = await unlocked(clock);
    expect(state.dailyInfo().unlocked).toBe(true);
    const first = DAILY.tiers[0];
    if (!first) throw new Error('no tiers');
    const coinsBefore = state.coins;
    const berriesBefore = state.berries;

    expect(state.startDailyAttempt()).toBe(true);
    const run = new PlayedRun(state, { mode: 'daily', seed: 20240610 });
    run.playLayers(first.height);
    expect(state.dailyInfo().claimedTiers).toEqual([]);
    // Restart from the pause: the scene shuts down (quit), then a new attempt starts.
    run.recorder.recordQuit(run.sim);
    const paidTiers = [...state.dailyInfo().claimedTiers];
    expect(paidTiers).toContain(first.height);
    expect(state.coins - coinsBefore).toBe(Math.floor(run.sim.state.coins) + tierCoins(paidTiers));
    expect(state.berries - berriesBefore).toBe(run.berriesPaid + tierBerries(paidTiers));
    // A second shutdown signal changes nothing.
    const afterFirst = { coins: state.coins, berries: state.berries };
    run.recorder.recordQuit(run.sim);
    expect(state.coins).toBe(afterFirst.coins);
    expect(state.berries).toBe(afterFirst.berries);

    expect(decideRestart(DAILY_RUN, () => state.startDailyAttempt())).toBe('run');
    expect(state.dailyInfo().attemptsLeft).toBe(DAILY.attempts - 2);
    const again = new PlayedRun(state, { mode: 'daily', seed: 20240610 });
    again.playLayers(first.height);
    again.recorder.recordQuit(again.sim);
    // The tiers reached before are not paid again: only newly reached ones and the run's coins.
    const claimed = state.dailyInfo().claimedTiers;
    expect(claimed.slice(0, paidTiers.length)).toEqual(paidTiers);
    const fresh = claimed.filter((height) => !paidTiers.includes(height));
    expect(state.coins - afterFirst.coins).toBe(
      Math.floor(again.sim.state.coins) + tierCoins(fresh),
    );
    expect(state.berries - afterFirst.berries).toBe(again.berriesPaid + tierBerries(fresh));
  });

  function tierCoins(heights: readonly number[]): number {
    return DAILY.tiers
      .filter((tier) => heights.includes(tier.height))
      .reduce((sum, tier) => sum + (tier.reward.coins ?? 0), 0);
  }

  function tierBerries(heights: readonly number[]): number {
    return DAILY.tiers
      .filter((tier) => heights.includes(tier.height))
      .reduce((sum, tier) => sum + (tier.reward.berries ?? 0), 0);
  }

  it('a daily restart with no attempt left opens the daily screen and starts nothing', async () => {
    const state = await unlocked({ ms: T_DAILY });
    for (let i = 0; i < DAILY.attempts; i++) expect(state.startDailyAttempt()).toBe(true);
    const runsBefore = state.data.stats.runs;
    expect(decideRestart(DAILY_RUN, () => state.startDailyAttempt())).toBe('daily-screen');
    expect(state.dailyInfo().attemptsLeft).toBe(0);
    expect(state.data.stats.runs).toBe(runsBefore);
  });
});

describe('dev runs stay out of the save', () => {
  it('?bot, ?start, ?team and ?level runs change nothing, however they end', () => {
    for (const query of [
      '?bot=45',
      '?start=20',
      '?team=honey,jelly',
      '?level=3',
      '?bot=45&start=20&team=honey&level=3',
    ]) {
      expect(savesRun(parseDebugParams(query))).toBe(false);
    }
    const state = createTestState({ ms: T0 });
    const before = JSON.stringify(state.data);
    const run = new PlayedRun(state, { writesSave: false, startHeight: 20, sd: 40 });
    run.playUntil('await_continue');
    run.decline();
    run.recorder.recordQuit(run.sim);
    expect(run.recorder.summary).toBeNull();
    expect(JSON.stringify(state.data)).toBe(before);
    expect(state.coins).toBe(0);
    expect(state.berries).toBe(0);
    expect(state.recordHeight).toBeNull();
    expect(state.todayBest).toBe(0);
  });

  it('a dev run quit midway changes nothing either', () => {
    const state = createTestState({ ms: T0 });
    const before = JSON.stringify(state.data);
    const run = new PlayedRun(state, { writesSave: false, seed: 2 });
    run.playLayers(6);
    run.recorder.recordQuit(run.sim);
    expect(JSON.stringify(state.data)).toBe(before);
  });

  it('the results of a dev run keep the XP bar where it is and cannot double the coins', () => {
    const state = createTestState({ ms: T0 });
    const run = new PlayedRun(state, { writesSave: false, sd: 40 });
    run.playUntil('await_continue');
    run.decline();
    const result = run.lastResult;
    if (!result) throw new Error('no result');
    const data = buildResultsData(
      {
        result,
        recorder: run.recorder,
        tally: emptyTally(),
        recorded: false,
        tower: {} as never,
        startHeight: 0,
        checkpoint: null,
      },
      state,
    );
    expect(data.recorded).toBe(false);
    expect(data.startHeight).toBe(0);
    expect(data.checkpoint).toBeNull();
    expect(data.summary.xpGained).toBe(0);
    expect(data.summary.levelUps).toEqual([]);
    expect(data.summary.before).toEqual({ level: state.data.bakerLevel, xp: state.data.bakerXp });
  });

  it('?tutorial, ?seed and ?debug runs are real play that counts (docs/08, section 9)', () => {
    for (const query of ['?tutorial=1', '?seed=5', '?debug=1']) {
      expect(savesRun(parseDebugParams(query))).toBe(true);
    }
  });
});

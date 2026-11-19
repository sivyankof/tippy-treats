import { describe, expect, it } from 'vitest';
import { checkpointRows } from '../core/zones/checkpoints';
import type { RunResult } from '../core/run/run-result';
import { createDefaultSave } from '../core/save/defaults';
import { BALANCE } from '../data/tower/balance';
import { MS_PER_DAY } from '../data/app/clock';
import { localDay } from '../util/clock';
import { NO_EXTRAS, statsOf } from './run-progress';
import { loadTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
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

/** A save of a player who has played before, with the given record and opened checkpoints. */
async function veteran(classicHeight: number, over: Record<string, unknown> = {}) {
  const clock = { ms: T0 };
  const base = createDefaultSave(T0, 'test');
  const state = await loadTestState(
    {
      ...base,
      stats: { ...base.stats, runs: 3 },
      records: { classicHeight, classicScore: 0, bestCombo: 0 },
      tutorial: { firstRunDone: true, hintsShown: ['tutorial', 'firstResults'] },
      ...over,
    },
    clock,
  );
  return { clock, state };
}

describe('opening checkpoints by a run', () => {
  it('a classic run opens the checkpoints of its full height', async () => {
    const { state } = await veteran(0);
    state.recordRun(run({ height: 45 }));
    expect(state.checkpoints).toEqual([20, 40]);
    state.recordRun(run({ height: 10 }));
    expect(state.checkpoints).toEqual([20, 40]);
  });

  it('a checkpoint run opens nothing new, however high it climbs', async () => {
    const { state } = await veteran(50, { checkpoints: [20, 40] });
    state.recordRun(run({ height: 65 }), 40);
    expect(state.checkpoints).toEqual([20, 40]);
    state.recordRun(run({ height: 105 }), 20);
    expect(state.checkpoints).toEqual([20, 40]);
  });

  it('a run from zero opens by the full height it reached', async () => {
    const { state } = await veteran(50, { checkpoints: [20, 40] });
    state.recordRun(run({ height: 65 }), 0);
    expect(state.checkpoints).toEqual([20, 40, 60]);
  });

  it('a checkpoint run still raises the classic record', async () => {
    const { state } = await veteran(45, { checkpoints: [20, 40] });
    state.recordRun(run({ height: 90 }), 40);
    expect(state.data.records.classicHeight).toBe(90);
    expect(state.checkpoints).toEqual([20, 40]);
  });

  it('a daily run never opens a checkpoint', async () => {
    const { state } = await veteran(0);
    state.recordRun(run({ mode: 'daily', height: 90 }));
    expect(state.checkpoints).toEqual([]);
  });
});

describe('records of a checkpoint run', () => {
  it('a run that beats the record from a checkpoint is a record', async () => {
    const { state } = await veteran(45, { checkpoints: [20, 40] });
    const summary = state.recordRun(run({ height: 52 }), 40);
    expect(summary.isRecord).toBe(true);
    expect(summary.previousRecord).toBe(45);
    expect(state.data.records.classicHeight).toBe(52);
  });

  it('a run that only reaches the record is not one, even if it started from a checkpoint', async () => {
    const { state } = await veteran(45, { checkpoints: [20, 40] });
    expect(state.recordRun(run({ height: 45 }), 40).isRecord).toBe(false);
    expect(state.data.records.classicHeight).toBe(45);
    expect(state.recordRun(run({ height: 41 }), 40).isRecord).toBe(false);
  });
});

describe('placed layers only', () => {
  it('XP, oven and total layers count the layers above the checkpoint', async () => {
    const { state } = await veteran(100, { checkpoints: [20, 40, 60, 80, 100] });
    const ovenBefore = state.ovenLeft;
    const totalBefore = state.data.stats.totalLayers;
    const summary = state.recordRun(run({ height: 60 }), 40);
    expect(state.data.stats.totalLayers - totalBefore).toBe(20);
    expect(summary.xpGained).toBe(20);
    expect(ovenBefore - state.ovenLeft).toBe(20);
    expect(state.recordRun(run({ height: 30 }), 40).xpGained).toBe(0);
  });

  it('missions count the placed layers for height and calm runs', () => {
    expect(statsOf(run({ height: 70 }), NO_EXTRAS).height).toBe(70);
    expect(statsOf(run({ height: 70 }), NO_EXTRAS, 60).height).toBe(10);
    expect(statsOf(run({ height: 50 }), NO_EXTRAS, 60).height).toBe(0);
  });

  it('a height mission is not filled by the layers of a checkpoint start', async () => {
    const items = [
      { id: 'height_half', group: 'medium', target: 30, progress: 0, claimed: false },
      { id: 'calm_run_15', group: 'medium', target: 30, progress: 0, claimed: false },
      { id: 'height_high', group: 'hard', target: 30, progress: 0, claimed: false },
    ];
    const { state } = await veteran(100, {
      checkpoints: [20, 40, 60, 80, 100],
      missions: { day: localDay(T0), items, rerollUsed: false, chestClaimed: false },
    });
    state.recordRun(run({ height: 70 }), 60);
    expect(state.missions.items.map((item) => item.progress)).toEqual([10, 10, 10]);
  });
});

describe('payCheckpoint', () => {
  it('refuses an unopened checkpoint and changes nothing', async () => {
    const { state } = await veteran(0, { berries: 100 });
    expect(state.payCheckpoint(20, 'berries')).toBe(false);
    expect(state.payCheckpoint(20, 'ad')).toBe(false);
    expect(state.berries).toBe(100);
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay);
  });

  it('spends the berry price, and nothing when short', async () => {
    const price = BALANCE.checkpoints.berries[40];
    const { state } = await veteran(45, { checkpoints: [20, 40], berries: price + 2 });
    expect(state.payCheckpoint(40, 'berries')).toBe(true);
    expect(state.berries).toBe(2);
    expect(state.payCheckpoint(40, 'berries')).toBe(false);
    expect(state.berries).toBe(2);
  });

  it('counts ad starts per day up to the limit and starts over tomorrow', async () => {
    const { state, clock } = await veteran(65, { checkpoints: [20, 40, 60] });
    const limit = BALANCE.checkpoints.adsPerDay;
    for (let i = 0; i < limit; i++) expect(state.payCheckpoint(20, 'ad')).toBe(true);
    expect(state.checkpointAdsLeft).toBe(0);
    expect(state.payCheckpoint(20, 'ad')).toBe(false);
    clock.ms += MS_PER_DAY;
    expect(state.checkpointAdsLeft).toBe(limit);
  });

  it('has no ad start for the high checkpoints', async () => {
    const { state } = await veteran(100, { checkpoints: [20, 40, 60, 80, 100] });
    expect(state.payCheckpoint(80, 'ad')).toBe(false);
    expect(state.payCheckpoint(100, 'ad')).toBe(false);
    expect(state.checkpointAdsLeft).toBe(BALANCE.checkpoints.adsPerDay);
  });

  it('builds the rows from the save', async () => {
    const { state } = await veteran(45, { checkpoints: [20, 40], berries: 7 });
    expect(state.checkpointRows(true)).toEqual(
      checkpointRows({
        opened: [20, 40],
        berries: 7,
        adReady: true,
        adsLeft: BALANCE.checkpoints.adsPerDay,
      }),
    );
  });
});

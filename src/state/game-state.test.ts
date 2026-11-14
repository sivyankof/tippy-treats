import { describe, expect, it, vi } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import type { RunResult } from '../core/run-result';
import { serializeSave } from '../core/save/load';
import type { Save } from '../core/save/schema';
import { SAVE_WRITE_DEBOUNCE_MS, STORAGE_KEYS } from '../data/storage';
import { MemoryStorage } from '../services/storage/memory';
import { xpToNext } from '../core/progression';
import { GameState, type LoadInfo, type Scheduler } from './game-state';

const T0 = 1_700_000_000_000;

/** Timers that only fire when the test says so. */
class ManualScheduler implements Scheduler {
  private next = 1;
  readonly pending = new Map<number, () => void>();
  set(callback: () => void): unknown {
    const id = this.next++;
    this.pending.set(id, callback);
    return id;
  }
  clear(handle: unknown): void {
    this.pending.delete(handle as number);
  }
  /** Fires everything that waits. */
  run(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    callbacks.forEach((callback) => callback());
  }
}

function setup(nowMs = T0) {
  const storage = new MemoryStorage();
  const scheduler = new ManualScheduler();
  const clock = { ms: nowMs };
  let ids = 0;
  const create = (): GameState =>
    new GameState({
      storage,
      realNow: () => clock.ms,
      makeInstallId: () => `id-${++ids}`,
      scheduler,
    });
  return { storage, scheduler, clock, create, state: create() };
}

/** Loads and expects the save to have been read. */
async function loaded(state: GameState): Promise<LoadInfo> {
  const outcome = await state.load();
  if (outcome.status !== 'loaded') throw new Error(`load ended with ${outcome.status}`);
  return outcome;
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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

async function stored(storage: MemoryStorage, key: string): Promise<Save> {
  return JSON.parse((await storage.get(key)) ?? 'null') as Save;
}

describe('GameState.load', () => {
  it('starts a new save when nothing is stored', async () => {
    const { state, scheduler, storage } = setup();
    const info = await loaded(state);
    expect(info.source).toBe('new');
    expect(state.data.installId).toBe('id-2');
    expect(state.data.lastSeenAt).toBe(T0);
    scheduler.run();
    await settle();
    expect((await stored(storage, STORAGE_KEYS.save)).installId).toBe('id-2');
  });

  it('reads the primary save', async () => {
    const { state, storage } = setup();
    const saved = { ...createDefaultSave(T0, 'abc'), coins: 77 };
    await storage.set(STORAGE_KEYS.save, serializeSave(saved));
    const info = await loaded(state);
    expect(info.source).toBe('primary');
    expect(state.coins).toBe(77);
    expect(state.data.installId).toBe('abc');
  });

  it('falls back to the backup and keeps the broken text', async () => {
    const { state, storage, clock } = setup();
    clock.ms = T0 + 5;
    await storage.set(STORAGE_KEYS.save, '{broken');
    await storage.set(
      STORAGE_KEYS.backup,
      serializeSave({ ...createDefaultSave(T0, 'b'), coins: 5 }),
    );
    const info = await loaded(state);
    expect(info.source).toBe('backup');
    expect(info.corruptKept).toBe(true);
    expect(state.coins).toBe(5);
    expect(await storage.get(`${STORAGE_KEYS.corruptPrefix}${T0 + 5}`)).toBe('{broken');
  });

  it('starts new and keeps the text when both saves are unusable', async () => {
    const { state, storage } = setup();
    await storage.set(STORAGE_KEYS.save, 'nope');
    await storage.set(STORAGE_KEYS.backup, '[]');
    const info = await loaded(state);
    expect(info.source).toBe('new');
    expect(info.corruptKept).toBe(true);
    expect(await storage.get(`${STORAGE_KEYS.corruptPrefix}${T0}`)).toBe('nope');
    expect(await storage.get(`${STORAGE_KEYS.corruptPrefix}${T0}_backup`)).toBe('[]');
    expect(state.coins).toBe(0);
  });

  it('keeps a save of a future version as corrupt', async () => {
    const { state, storage } = setup();
    const future = JSON.stringify({ ...createDefaultSave(T0, 'f'), version: 99 });
    await storage.set(STORAGE_KEYS.save, future);
    const info = await loaded(state);
    expect(info.source).toBe('new');
    expect(await storage.get(`${STORAGE_KEYS.corruptPrefix}${T0}`)).toBe(future);
  });

  it('starts from a new save and overwrites the old one on reset', async () => {
    const { state, storage } = setup();
    await storage.set(
      STORAGE_KEYS.save,
      serializeSave({ ...createDefaultSave(T0, 'old'), coins: 9 }),
    );
    await storage.set(STORAGE_KEYS.backup, serializeSave(createDefaultSave(T0, 'old')));
    await state.load({ reset: true });
    expect(state.coins).toBe(0);
    await settle();
    expect((await stored(storage, STORAGE_KEYS.save)).coins).toBe(0);
    expect(await storage.get(STORAGE_KEYS.backup)).toBeNull();
  });

  it('plays on a new save and writes nothing when the read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const writes: string[] = [];
    const scheduler = new ManualScheduler();
    const failing = new GameState({
      storage: {
        get: () => Promise.reject(new Error('read')),
        set: (key) => {
          writes.push(key);
          return Promise.resolve();
        },
        remove: () => Promise.resolve(),
      },
      realNow: () => T0,
      makeInstallId: () => 'id',
      scheduler,
    });
    await expect(failing.load()).resolves.toEqual({ status: 'read_failed' });
    expect(warn).toHaveBeenCalledTimes(1);
    failing.addBerries(2);
    failing.recordRun(run());
    expect(failing.coins).toBe(30);
    scheduler.run();
    failing.flush();
    await settle();
    expect(writes).toEqual([]);
    warn.mockRestore();
  });

  it('never throws when every storage call fails, and tries the write again later', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scheduler = new ManualScheduler();
    const failing = new GameState({
      storage: {
        get: () => Promise.resolve(null),
        set: () => Promise.reject(new Error('write')),
        remove: () => Promise.reject(new Error('remove')),
      },
      realNow: () => T0,
      makeInstallId: () => 'id',
      scheduler,
    });
    await expect(failing.load()).resolves.toMatchObject({ source: 'new' });
    scheduler.run();
    await settle();
    // The failed write armed the retry timer.
    expect(scheduler.pending.size).toBe(1);
    warn.mockRestore();
  });

  it('keeps lastSeenAt on the real clock it was given', async () => {
    const { state, clock } = setup();
    await state.load();
    clock.ms = T0 + 10_000;
    state.flush();
    expect(state.data.lastSeenAt).toBe(T0 + 10_000);
    expect(state.clockBehind).toBe(false);
  });

  it('moves lastSeenAt forward only, so a set-back clock stays visible', async () => {
    const { state, storage, clock } = setup();
    await storage.set(
      STORAGE_KEYS.save,
      serializeSave({ ...createDefaultSave(T0, 'a'), lastSeenAt: T0 }),
    );
    clock.ms = T0 - 3_600_000;
    const info = await loaded(state);
    expect(info.previousSeenAt).toBe(T0);
    expect(state.data.lastSeenAt).toBe(T0);
    expect(state.clockBehind).toBe(true);
    clock.ms = T0 + 1000;
    expect(state.clockBehind).toBe(false);
  });
});

describe('GameState writes', () => {
  it('coalesces changes into one write after the debounce', async () => {
    const { state, storage, scheduler } = setup();
    await state.load();
    scheduler.run();
    await settle();
    const spy = vi.spyOn(storage, 'set');
    state.addBerries(1);
    state.addBerries(1);
    state.addBerries(1);
    expect(scheduler.pending.size).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    scheduler.run();
    await settle();
    expect(spy.mock.calls.filter(([key]) => key === STORAGE_KEYS.save)).toHaveLength(1);
    expect((await stored(storage, STORAGE_KEYS.save)).berries).toBe(3);
    expect(SAVE_WRITE_DEBOUNCE_MS).toBe(500);
  });

  it('puts the previous written text into the backup', async () => {
    const { state, storage, scheduler } = setup();
    await state.load();
    scheduler.run();
    await settle();
    state.addBerries(2);
    scheduler.run();
    await settle();
    state.addBerries(3);
    scheduler.run();
    await settle();
    expect((await stored(storage, STORAGE_KEYS.save)).berries).toBe(5);
    expect((await stored(storage, STORAGE_KEYS.backup)).berries).toBe(2);
  });

  it('flushes at once and cancels the timer', async () => {
    const { state, storage, scheduler } = setup();
    await state.load();
    scheduler.run();
    await settle();
    state.addBerries(4);
    state.flush();
    expect(scheduler.pending.size).toBe(0);
    await settle();
    expect((await stored(storage, STORAGE_KEYS.save)).berries).toBe(4);
  });

  it('does not write when nothing changed', async () => {
    const { state, storage, scheduler } = setup();
    await state.load();
    state.flush();
    await settle();
    const spy = vi.spyOn(storage, 'set');
    state.flush();
    scheduler.run();
    expect(spy).not.toHaveBeenCalled();
  });

  it('survives a reload', async () => {
    const { state, create, scheduler } = setup();
    await state.load();
    state.addBerries(6);
    state.updateSettings({ sfx: false });
    state.flush();
    scheduler.run();
    await settle();
    const again = create();
    const info = await loaded(again);
    expect(info.source).toBe('primary');
    expect(again.berries).toBe(6);
    expect(again.settings.sfx).toBe(false);
  });
});

describe('GameState runs', () => {
  it('never counts the first run ever as a record, later runs compare with the saved best', async () => {
    const { state } = setup();
    await state.load();
    expect(state.recordHeight).toBeNull();
    expect(state.recordRun(run({ height: 50 })).isRecord).toBe(false);
    expect(state.recordHeight).toBe(50);
    expect(state.recordRun(run({ height: 50 })).isRecord).toBe(false);
    expect(state.recordRun(run({ height: 51 })).isRecord).toBe(true);
    expect(state.recordRun(run({ height: 5 })).isRecord).toBe(false);
    expect(state.data.records.classicHeight).toBe(51);
  });

  it('keeps a zero-height first run as the baseline', async () => {
    const { state } = setup();
    await state.load();
    state.recordRun(run({ height: 0 }));
    expect(state.recordRun(run({ height: 1 })).isRecord).toBe(true);
  });

  it('keeps the record across a reload, so the first run of a later session can be one', async () => {
    const { state, create, scheduler } = setup();
    await state.load();
    state.recordRun(run({ height: 20 }));
    state.flush();
    scheduler.run();
    await settle();
    const again = create();
    await again.load();
    expect(again.recordHeight).toBe(20);
    expect(again.recordRun(run({ height: 21 })).isRecord).toBe(true);
  });

  it('credits the coins of a run when it ends, whatever the outcome', async () => {
    const { state } = setup();
    await state.load();
    state.recordRun(run({ coins: 40, endReason: 'miss' }));
    state.recordRun(run({ coins: 5, endReason: 'sneeze' }));
    state.recordRun(run({ coins: 7, endReason: 'quit' }));
    expect(state.coins).toBe(52);
  });

  it('does not credit berries at the end of a run: they went in when earned', async () => {
    const { state } = setup();
    await state.load();
    state.addBerries(2);
    state.recordRun(run({ berries: 2 }));
    expect(state.berries).toBe(2);
  });

  it('updates stats, records and the tutorial flag', async () => {
    const { state } = setup();
    await state.load();
    state.recordRun(run({ height: 12, score: 300, perfects: 4, bestCombo: 6 }));
    state.recordRun(run({ height: 8, score: 500, perfects: 1, bestCombo: 2 }));
    expect(state.data.stats).toMatchObject({ runs: 2, totalLayers: 20, perfects: 5 });
    expect(state.data.records).toEqual({ classicHeight: 12, classicScore: 500, bestCombo: 6 });
    expect(state.data.tutorial.firstRunDone).toBe(true);
  });

  it('leaves the classic records alone for a daily run', async () => {
    const { state } = setup();
    await state.load();
    state.recordRun(run({ height: 30 }));
    state.recordRun(run({ mode: 'daily', height: 90 }));
    expect(state.data.records.classicHeight).toBe(30);
    expect(state.recordRun(run({ mode: 'daily', height: 99 })).isRecord).toBe(false);
  });

  it('turns layers into XP and pays level-up rewards', async () => {
    const { state } = setup();
    await state.load();
    const need = xpToNext(1);
    const summary = state.recordRun(run({ height: need, coins: 0 }));
    expect(summary.xpGained).toBe(need);
    expect(summary.levelUps.map((up) => up.level)).toEqual([2]);
    expect(state.data.bakerLevel).toBe(2);
    expect(state.data.bakerXp).toBe(0);
    // Level 2 hands over the Puff.
    expect(state.data.creatures.puff).toEqual({ level: 1 });
  });

  it('pays coins and berries of several levels gained at once', async () => {
    const { state } = setup();
    await state.load();
    let total = 0;
    for (let level = 1; level < 5; level++) total += xpToNext(level);
    const summary = state.recordRun(run({ height: total, coins: 0 }));
    expect(summary.levelUps.map((up) => up.level)).toEqual([2, 3, 4, 5]);
    expect(state.data.bakerLevel).toBe(5);
    // Level 4: 100 coins, level 5: 10 berries.
    expect(state.coins).toBe(100);
    expect(state.berries).toBe(10);
  });

  it('does not give XP for the checkpoint a run started from', async () => {
    const { state } = setup();
    await state.load();
    expect(state.recordRun(run({ height: 30 }), 25).xpGained).toBe(5);
  });
});

describe('GameState wallet', () => {
  it('adds whole berries at once', async () => {
    const { state } = setup();
    await state.load();
    state.addBerries(5);
    state.addBerries(2.9);
    state.addBerries(-4);
    state.addBerries(0);
    state.addBerries(Number.NaN);
    expect(state.berries).toBe(7);
  });

  it('never goes below zero', async () => {
    const { state } = setup();
    await state.load();
    state.addBerries(20);
    expect(state.spendBerries(15)).toBe(true);
    expect(state.berries).toBe(5);
    expect(state.canAffordBerries(6)).toBe(false);
    expect(state.spendBerries(6)).toBe(false);
    expect(state.spend({ coins: 1 })).toBe(false);
    expect(state.spendBerries(-1)).toBe(false);
    expect(state.berries).toBe(5);
    expect(state.coins).toBe(0);
  });
});

describe('GameState hints', () => {
  it('keeps the tutorial pending until it is marked done, and keeps hints across a reload', async () => {
    const { state, create, scheduler } = setup();
    await state.load();
    expect(state.beginRun()).toBe(true);
    expect(state.beginRun()).toBe(true);
    state.markHint('wobble');
    state.markHint('wobble');
    state.markHint('tutorial');
    expect(state.beginRun()).toBe(false);
    expect(state.data.tutorial.hintsShown).toEqual(['wobble', 'tutorial']);
    state.flush();
    scheduler.run();
    await settle();
    const again = create();
    await again.load();
    expect(again.beginRun()).toBe(false);
    expect(again.hasHint('wobble')).toBe(true);
    expect(again.hasHint('berry')).toBe(false);
  });

  it('?tutorial=1: a tutorial run with fresh hints for this page load, nothing saved', async () => {
    const { state } = setup();
    await state.load();
    state.markHint('tutorial');
    state.markHint('berry');
    for (let i = 0; i < 3; i++) {
      expect(state.beginRun(true)).toBe(true);
      expect(state.hasHint('berry')).toBe(false);
      state.markHint('tap');
      expect(state.hasHint('tap')).toBe(true);
    }
    state.markHint('tutorial');
    expect(state.data.tutorial.hintsShown).toEqual(['tutorial', 'berry']);
  });

  it('?tutorial=0: no tutorial run, every hint counts as shown, nothing saved', async () => {
    const { state } = setup();
    await state.load();
    expect(state.beginRun(false)).toBe(false);
    expect(state.hasHint('berry')).toBe(true);
    state.markHint('wobble');
    expect(state.data.tutorial.hintsShown).toEqual([]);
  });
});

describe('GameState settings', () => {
  it('keeps the settings across a reload', async () => {
    const { state, create, scheduler } = setup();
    await state.load();
    expect(state.settings.reducedFx).toBe('auto');
    state.updateSettings({ sfx: false, haptics: false, reducedFx: 'on' });
    state.flush();
    scheduler.run();
    await settle();
    const again = create();
    await again.load();
    expect(again.settings).toMatchObject({
      sfx: false,
      haptics: false,
      reducedFx: 'on',
      music: true,
    });
  });
});

/** Storage whose reads answer only when the test lets them. */
class SlowStorage extends MemoryStorage {
  private release: (() => void) | null = null;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  readonly writes: string[] = [];
  override async get(key: string): Promise<string | null> {
    await this.gate;
    return super.get(key);
  }
  override set(key: string, value: string): Promise<void> {
    this.writes.push(key);
    return super.set(key, value);
  }
  open(): void {
    this.release?.();
  }
}

describe('GameState.load timeout', () => {
  function slowSetup() {
    const storage = new SlowStorage();
    const scheduler = new ManualScheduler();
    const state = new GameState({
      storage,
      realNow: () => T0,
      makeInstallId: () => 'fresh',
      scheduler,
    });
    return { storage, scheduler, state };
  }

  it('resolves to timeout, plays on a new save and never writes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { storage, scheduler, state } = slowSetup();
    await storage.set('save', serializeSave({ ...createDefaultSave(T0, 'real'), coins: 500 }));
    storage.writes.length = 0;
    const pending = state.load({ timeoutMs: 2000 });
    scheduler.run();
    expect(await pending).toEqual({ status: 'timeout' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(state.data.installId).toBe('fresh');
    state.addBerries(2);
    state.recordRun(run());
    expect(state.coins).toBe(30);
    scheduler.run();
    state.flush();
    await settle();
    expect(storage.writes).toEqual([]);
    warn.mockRestore();
  });

  it('drops a read that finishes after the timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { storage, scheduler, state } = slowSetup();
    await storage.set('save', serializeSave({ ...createDefaultSave(T0, 'real'), coins: 500 }));
    storage.writes.length = 0;
    const pending = state.load({ timeoutMs: 2000 });
    scheduler.run();
    await pending;
    storage.open();
    await settle();
    expect(state.data.installId).toBe('fresh');
    expect(state.coins).toBe(0);
    state.flush();
    await settle();
    expect(storage.writes).toEqual([]);
    warn.mockRestore();
  });

  it('loads normally when the storage answers in time', async () => {
    const { storage, scheduler, state } = slowSetup();
    storage.open();
    const outcome = await state.load({ timeoutMs: 2000 });
    expect(outcome.status).toBe('loaded');
    expect(scheduler.pending.size).toBe(1);
    state.flush();
    await settle();
    expect(storage.writes).toContain('save');
  });
});

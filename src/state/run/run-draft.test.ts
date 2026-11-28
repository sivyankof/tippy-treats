import { describe, expect, it } from 'vitest';
import type { RunResult } from '../../core/run/run-result';
import { createDefaultSave } from '../../core/save/defaults';
import { serializeSave } from '../../core/save/load';
import { STORAGE_KEYS } from '../../data/app/storage';
import { MemoryStorage } from '../../services/storage/memory';
import { GameState } from '../game-state';
import { draftMatches, makeRunDraft, readRunDraft } from './run-draft';
import { NO_EXTRAS } from '../run-progress';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 7,
    mode: 'classic',
    height: 25,
    score: 400,
    coins: 60,
    berries: 2,
    perfects: 5,
    bestCombo: 4,
    continuesUsed: 1,
    zoneIndex: 1,
    durationMs: 50_000,
    endReason: 'quit',
    ...over,
  };
}

const EXTRAS = { floatingCoins: 3, abilities: 2, maxWobble: 0.4, flies: 1 };

/** A launch of the app over `storage`: a new state that reads the save. */
async function launch(storage: MemoryStorage, clock = { ms: T0 }): Promise<GameState> {
  const state = new GameState({
    storage,
    realNow: () => clock.ms,
    now: () => clock.ms,
    makeInstallId: () => 'device-a',
    scheduler: { set: () => 0, clear: () => undefined },
  });
  await state.load();
  return state;
}

/** A player with a few runs, as stored on the device. */
async function stored(bakerLevel = 1): Promise<MemoryStorage> {
  const storage = new MemoryStorage();
  const base = createDefaultSave(T0 - 10 * 86_400_000, 'device-a');
  const save = { ...base, bakerLevel, coins: 500, stats: { ...base.stats, runs: 8 } };
  await storage.set(STORAGE_KEYS.save, serializeSave(save));
  return storage;
}

describe('run draft', () => {
  it('a run left in the background and unloaded is recorded at the next launch, once', async () => {
    const storage = await stored();
    const playing = await launch(storage);
    await playing.keepRunDraft(run(), 0, EXTRAS);
    // The system unloads the app: nothing else reaches the storage.
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(true);
    expect(next.data.coins).toBeGreaterThanOrEqual(560);
    expect(next.data.stats.runs).toBe(9);
    expect(next.data.records.classicHeight).toBe(25);
    expect(next.data.stats.flies).toBe(1);
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
    // The save reached the storage: one more launch sees the run there and no draft.
    const third = await launch(storage);
    expect(await third.recoverRunDraft()).toBe(false);
    expect(third.data.stats.runs).toBe(9);
    expect(third.data.coins).toBe(next.data.coins);
  });

  it('back in the live app the draft goes and the run is recorded only at its end', async () => {
    const storage = await stored();
    const playing = await launch(storage);
    await playing.keepRunDraft(run(), 0, EXTRAS);
    await playing.dropRunDraft();
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
    playing.recordRun(run({ endReason: 'miss', height: 30 }), 0, EXTRAS);
    playing.flush();
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(false);
    expect(next.data.stats.runs).toBe(9);
  });

  it('a run recorded after its draft removes the draft', async () => {
    const storage = await stored();
    const playing = await launch(storage);
    await playing.keepRunDraft(run(), 0, EXTRAS);
    playing.recordRun(run({ endReason: 'miss' }), 0, EXTRAS);
    await Promise.resolve();
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
    const next = await launch(storage);
    expect(next.data.stats.runs).toBe(9);
  });

  it('a draft left behind by a run already in the save is not counted twice', async () => {
    const storage = await stored();
    const playing = await launch(storage);
    await playing.keepRunDraft(run(), 0, EXTRAS);
    const draft = await storage.get(STORAGE_KEYS.runDraft);
    playing.recordRun(run({ endReason: 'miss' }), 0, EXTRAS);
    playing.flush();
    // The removal of the draft did not land, the save did.
    await storage.set(STORAGE_KEYS.runDraft, draft ?? '');
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(false);
    expect(next.data.stats.runs).toBe(9);
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
  });

  it('a draft of another save (a reset since) is dropped', async () => {
    const storage = await stored();
    const playing = await launch(storage);
    await playing.keepRunDraft(run(), 0, EXTRAS);
    playing.resetProgress();
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(false);
    expect(next.data.stats.runs).toBe(0);
  });

  it('a draft that cannot be read is dropped', async () => {
    const storage = await stored();
    await storage.set(STORAGE_KEYS.runDraft, '{"v":1,"result":{"coins":-5}}');
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(false);
    expect(next.data.stats.runs).toBe(8);
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
  });

  it('a daily run keeps the UTC day of its attempt', async () => {
    // The daily tower opens at a higher baker level.
    const storage = await stored(12);
    const playing = await launch(storage);
    expect(playing.startDailyAttempt()).toBe(true);
    playing.flush();
    await playing.keepRunDraft(run({ mode: 'daily', height: 18 }), 0, EXTRAS);
    const next = await launch(storage);
    expect(await next.recoverRunDraft()).toBe(true);
    expect(next.data.daily.best).toBe(18);
  });
});

describe('readRunDraft', () => {
  const save = createDefaultSave(T0, 'device-a');
  const draft = makeRunDraft(save, run(), 20, { ...EXTRAS, coinSources: { combo: 9 } }, '');

  it('reads back what was written, without the dev tally', () => {
    expect(readRunDraft(JSON.stringify(draft))).toEqual(draft);
    expect(draft.extras).toEqual(EXTRAS);
    expect(draftMatches(draft, save)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['not JSON', '{'],
    ['another version', { ...draft, v: 2 }],
    ['an unknown mode', { ...draft, result: { ...draft.result, mode: 'zen' } }],
    ['a negative count', { ...draft, result: { ...draft.result, coins: -1 } }],
    ['missing extras', { ...draft, extras: undefined }],
    ['a missing day', { ...draft, attemptDay: 3 }],
  ])('refuses %s', (_name, raw) => {
    expect(readRunDraft(typeof raw === 'string' ? raw : JSON.stringify(raw))).toBeNull();
  });

  it('belongs only to the same install, save and run count', () => {
    expect(draftMatches(draft, { ...save, installId: 'other' })).toBe(false);
    expect(draftMatches(draft, { ...save, createdAt: T0 + 1 })).toBe(false);
    expect(draftMatches(draft, { ...save, stats: { ...save.stats, runs: 1 } })).toBe(false);
  });

  it('needs no extras beyond the empty ones', () => {
    const plain = makeRunDraft(save, run(), 0, NO_EXTRAS, '');
    expect(readRunDraft(JSON.stringify(plain))?.extras).toEqual(NO_EXTRAS);
  });
});

describe('run draft at launch, when something goes wrong', () => {
  it('a storage that does not answer leaves the draft and does not hold the start', async () => {
    const storage = new MemoryStorage();
    await storage.set(STORAGE_KEYS.save, serializeSave(createDefaultSave(T0, 'device-a')));
    const due: Array<() => void> = [];
    const state = new GameState({
      storage,
      realNow: () => T0,
      now: () => T0,
      makeInstallId: () => 'device-a',
      scheduler: { set: (run) => due.push(run), clear: () => undefined },
    });
    await state.load();
    storage.get = () => new Promise(() => undefined);
    const recovery = state.recoverRunDraft(2000);
    for (const run of due) run();
    expect(await recovery).toBe(false);
  });

  it('a draft whose recording throws is still removed', async () => {
    const storage = new MemoryStorage();
    const base = createDefaultSave(T0, 'device-a');
    await storage.set(STORAGE_KEYS.save, serializeSave(base));
    const draft = makeRunDraft(base, run(), 0, EXTRAS, '');
    await storage.set(STORAGE_KEYS.runDraft, JSON.stringify(draft));
    const state = await launch(storage);
    state.recordRun = () => {
      throw new Error('broken');
    };
    expect(await state.recoverRunDraft()).toBe(false);
    await Promise.resolve();
    expect(await storage.get(STORAGE_KEYS.runDraft)).toBeNull();
  });
});

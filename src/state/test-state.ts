import { serializeSave } from '../core/save/load';
import type { Save } from '../core/save/schema';
import { STORAGE_KEYS } from '../data/storage';
import { MemoryStorage } from '../services/storage/memory';
import { GameState } from './game-state';

/**
 * A state on in-memory storage with timers that never fire, for tests of code that reads or marks
 * the save. `clock.ms` is both the game clock and the real clock; move it to change the day.
 */
export function createTestState(clock: { ms: number } = { ms: 1_700_000_000_000 }): GameState {
  return build(new MemoryStorage(), clock);
}

/** Like `createTestState`, but starts from a given save (read through the normal load). */
export async function loadTestState(save: Save, clock: { ms: number }): Promise<GameState> {
  const storage = new MemoryStorage();
  await storage.set(STORAGE_KEYS.save, serializeSave(save));
  const state = build(storage, clock);
  await state.load();
  return state;
}

function build(storage: MemoryStorage, clock: { ms: number }): GameState {
  let counter = 0;
  return new GameState({
    storage,
    realNow: () => clock.ms,
    now: () => clock.ms,
    makeInstallId: () => `test-${++counter}`,
    scheduler: { set: () => 0, clear: () => undefined },
  });
}

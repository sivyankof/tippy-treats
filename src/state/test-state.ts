import { serializeSave } from '../core/save/load';
import type { Save } from '../core/save/schema';
import { OVEN } from '../data/progression/progression';
import { STORAGE_KEYS } from '../data/app/storage';
import { MemoryStorage } from '../services/storage/memory';
import { GameState } from './game-state';
import type { SessionTally } from './session-tally';

/**
 * A state on in-memory storage with timers that never fire, for tests of code that reads or marks
 * the save. `clock.ms` is both the game clock and the real clock; move it to change the day.
 */
export function createTestState(
  clock: { ms: number } = { ms: 1_700_000_000_000 },
  storage: MemoryStorage = new MemoryStorage(),
  tally?: SessionTally,
): GameState {
  return build(storage, clock, tally);
}

/** Like `createTestState`, but starts from a given save (read through the normal load). */
export async function loadTestState(
  save: Save,
  clock: { ms: number },
  tally?: SessionTally,
): Promise<GameState> {
  const storage = new MemoryStorage();
  await storage.set(STORAGE_KEYS.save, serializeSave(save));
  const state = build(storage, clock, tally);
  await state.load();
  return state;
}

function build(storage: MemoryStorage, clock: { ms: number }, tally?: SessionTally): GameState {
  let counter = 0;
  return new GameState({
    storage,
    realNow: () => clock.ms,
    now: () => clock.ms,
    makeInstallId: () => `test-${++counter}`,
    scheduler: { set: () => 0, clear: () => undefined },
    tally,
  });
}

/**
 * Layers a first run of a fresh local day needs to pay `xp` baker XP: the fresh oven pays 1 XP per
 * layer for the first `OVEN.freshLayers`, later layers `OVEN.layersPerXp` per XP.
 */
export function layersForXp(xp: number): number {
  return xp <= OVEN.freshLayers
    ? xp
    : OVEN.freshLayers + (xp - OVEN.freshLayers) * OVEN.layersPerXp;
}

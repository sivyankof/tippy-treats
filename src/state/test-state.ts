import { MemoryStorage } from '../services/storage/memory';
import { GameState } from './game-state';

/** A state on in-memory storage with timers that never fire, for tests of code that reads or marks the save. */
export function createTestState(): GameState {
  let counter = 0;
  return new GameState({
    storage: new MemoryStorage(),
    realNow: () => 1_700_000_000_000,
    makeInstallId: () => `test-${++counter}`,
    scheduler: { set: () => 0, clear: () => undefined },
  });
}

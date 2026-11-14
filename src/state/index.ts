import { services } from '../services';
import { realNow } from '../util/clock';
import { makeInstallId } from '../util/install-id';
import { GameState, type Scheduler } from './game-state';

const timers: Scheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The save of the running game. `main.ts` loads it before the first scene starts. */
export const gameState = new GameState({
  storage: services.storage,
  realNow,
  makeInstallId,
  scheduler: timers,
});

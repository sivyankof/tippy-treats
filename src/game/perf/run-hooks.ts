import type { LickKind, LickScene, LickStage } from '../objects/lick-plan';

/**
 * What the running scene lets the `?perf=1` director poke at, in dev and production builds alike
 * (the `window.tippy*` hooks of the dev server stay as they are). The scene's effects layer
 * registers it when a run begins; a new run replaces it.
 */
export interface RunHooks {
  /** A layer licks right away; true when one could. */
  lick(scene: LickScene, kind: LickKind): boolean;
  /** The beat of the lick that is on, `null` when none. */
  lickStage(): LickStage | null;
  /** The guest of the zone sits on the top layer right away; true when it could. */
  guest(): boolean;
  /** The next Rainbow star pops its small rainbow right away. */
  rainbowJoke(): void;
  /** The Rainbow arc has grown out fully. */
  arcGrown(): boolean;
}

let current: RunHooks | null = null;

export function setRunHooks(hooks: RunHooks): void {
  current = hooks;
}

export function runHooks(): RunHooks | null {
  return current;
}

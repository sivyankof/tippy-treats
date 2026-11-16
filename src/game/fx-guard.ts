import { devWarn } from './dev-warn';

/**
 * The safety net of the decorations (docs/08, "Страховочная обёртка декораций"): a failure in an
 * effect (particles, captions, a lick, the backdrop) skips that effect for the frame and the game
 * goes on. Core code (the sim step, scoring, the save) is never run through it: its errors stay
 * visible. Each effect is named, and a broken one warns once per run, not every frame.
 */
export class FxGuard {
  private readonly warned = new Set<string>();

  constructor(private readonly warn: (message: string, error?: unknown) => void) {}

  /** Runs `fn`; on a throw calls `onFail` (cleanup, itself guarded) and warns once per name. */
  run(name: string, fn: () => void, onFail?: () => void): void {
    try {
      fn();
    } catch (error) {
      this.report(name, error);
      if (onFail) {
        try {
          onFail();
        } catch (cleanupError) {
          this.report(`${name} (cleanup)`, cleanupError);
        }
      }
    }
  }

  /** Like `run` for a value: `fallback` when the effect threw (after the optional `onFail`). */
  value<T>(name: string, fn: () => T, fallback: T, onFail?: () => void): T {
    let result = fallback;
    this.run(
      name,
      () => {
        result = fn();
      },
      onFail,
    );
    return result;
  }

  /** A new run: the effects warn again. */
  reset(): void {
    this.warned.clear();
  }

  private report(name: string, error: unknown): void {
    if (this.warned.has(name)) return;
    this.warned.add(name);
    this.warn(`Effect "${name}" failed and was skipped`, error);
  }
}

/** The guard of the game: warns in the dev build only. */
export const fxGuard = new FxGuard(devWarn);

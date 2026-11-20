import { devWarn } from './dev-warn';

/** A method called by `FxGuard.call` with up to five arguments. */
type GuardedMethod = (
  this: unknown,
  a?: unknown,
  b?: unknown,
  c?: unknown,
  d?: unknown,
  e?: unknown,
) => unknown;

/**
 * The safety net of the decorations (docs/08, "Страховочная обёртка декораций"): a failure in an
 * effect (particles, captions, a lick, the backdrop) skips that effect for the frame and the game
 * goes on. Core code (the sim step, scoring, the save) is never run through it: its errors stay
 * visible. Each effect is named, and a broken one warns once per run, not every frame.
 */
export class FxGuard {
  private readonly warned = new Set<string>();
  private reporter: ((name: string, error: unknown) => void) | null = null;

  constructor(private readonly warn: (message: string, error?: unknown) => void) {}

  /**
   * Where a skipped effect is reported besides the warning (Crashlytics, as a non-fatal; the
   * reporter limits how often itself). It hears of each failing effect once per run, like the warning.
   */
  setReporter(reporter: ((name: string, error: unknown) => void) | null): void {
    this.reporter = reporter;
  }

  /**
   * The per-frame form: calls `method` on `target` with the given arguments, so no closure is
   * made per call. Returns false when it threw (the caller may then clean up with `cleanup`).
   */
  call<T>(name: string, target: T, method: (this: T) => unknown): boolean;
  call<T, A>(name: string, target: T, method: (this: T, a: A) => unknown, a: A): boolean;
  call<T, A, B>(
    name: string,
    target: T,
    method: (this: T, a: A, b: B) => unknown,
    a: A,
    b: B,
  ): boolean;
  call<T, A, B, C>(
    name: string,
    target: T,
    method: (this: T, a: A, b: B, c: C) => unknown,
    a: A,
    b: B,
    c: C,
  ): boolean;
  call<T, A, B, C, D>(
    name: string,
    target: T,
    method: (this: T, a: A, b: B, c: C, d: D) => unknown,
    a: A,
    b: B,
    c: C,
    d: D,
  ): boolean;
  call<T, A, B, C, D, E>(
    name: string,
    target: T,
    method: (this: T, a: A, b: B, c: C, d: D, e: E) => unknown,
    a: A,
    b: B,
    c: C,
    d: D,
    e: E,
  ): boolean;
  call(
    name: string,
    target: unknown,
    method: GuardedMethod,
    a?: unknown,
    b?: unknown,
    c?: unknown,
    d?: unknown,
    e?: unknown,
  ): boolean {
    try {
      method.call(target, a, b, c, d, e);
      return true;
    } catch (error) {
      this.report(name, error);
      return false;
    }
  }

  /** The cleanup after a failed `call` of `name`: itself guarded, it warns as "<name> (cleanup)". */
  cleanup<T>(name: string, target: T, method: (this: T) => unknown): void {
    try {
      method.call(target);
    } catch (error) {
      this.report(`${name} (cleanup)`, error);
    }
  }

  /** Runs `fn`; on a throw calls `onFail` (cleanup, itself guarded) and warns once per name. */
  run(name: string, fn: () => void, onFail?: () => void): void {
    try {
      fn();
    } catch (error) {
      this.report(name, error);
      if (onFail) this.cleanup(name, null, onFail);
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
    try {
      this.reporter?.(name, error);
    } catch {
      // Reporting is a decoration of a decoration.
    }
  }
}

/** The guard of the game: warns in the dev build only. */
export const fxGuard = new FxGuard(devWarn);

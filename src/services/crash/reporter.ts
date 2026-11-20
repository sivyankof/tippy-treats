import { CRASH } from '../../data/app/telemetry';
import { describeError } from './describe';
import type { CrashContext, CrashService } from './types';

/** What the reporter asks of the game at the moment of a failure. */
export interface CrashSource {
  scene(): string;
  saveVersion(): number;
}

/** The minimum of a browser window the handlers need (injected, so tests run without a browser). */
export interface ErrorTarget {
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  addEventListener(
    type: 'unhandledrejection',
    listener: (event: PromiseRejectionEvent) => void,
  ): void;
}

/**
 * Sends the failures of the game to the crash service as non-fatal reports, with the current scene
 * and save version. It never throws, never reports the same failure twice (same message and top
 * of the stack) and stops after `CRASH.sessionMax` reports of one page load.
 */
export class CrashReporter {
  private readonly seen = new Set<string>();
  private readonly perEffect = new Map<string, number>();
  private sent = 0;
  private effectsSent = 0;

  constructor(
    private readonly service: CrashService,
    private readonly source: CrashSource,
  ) {}

  /** A failure of the page: an uncaught error or a promise nobody caught. */
  reportFailure(error: unknown, kind: 'error' | 'rejection'): void {
    this.send(error, kind);
  }

  /** A decoration that `fxGuard` skipped; each effect name is sent `CRASH.effectMax` times, all effects `CRASH.effectsTotalMax` times. */
  reportEffect(name: string, error: unknown): void {
    const count = this.perEffect.get(name) ?? 0;
    if (count >= CRASH.effectMax || this.effectsSent >= CRASH.effectsTotalMax) return;
    if (this.send(error, `effect:${name}`)) {
      this.perEffect.set(name, count + 1);
      this.effectsSent++;
    }
  }

  /** The debug menu's test: a report that skips the duplicate check and the limits. */
  reportTest(): void {
    this.deliver(new Error('Test non-fatal from the debug menu'), 'test');
  }

  private send(error: unknown, kind: string): boolean {
    try {
      if (this.sent >= CRASH.sessionMax) return false;
      const { message, frames } = describeError(error);
      if (CRASH.ignoredMessages.some((ignored) => message.includes(ignored))) return false;
      const key = `${message}|${frames[0]?.fileName ?? ''}:${frames[0]?.lineNumber ?? ''}`;
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      this.sent++;
      this.deliver(error, kind);
      return true;
    } catch {
      return false;
    }
  }

  private deliver(error: unknown, kind: string): void {
    try {
      const context: CrashContext = {
        scene: this.source.scene(),
        saveVersion: this.source.saveVersion(),
        kind,
      };
      this.service.recordError(error, context);
    } catch {
      // Reporting a failure must never cause one.
    }
  }
}

/**
 * Listens for `error` and `unhandledrejection` of the window and reports them. The listeners
 * leave the event alone: the browser (and the dev console) still print it as before.
 */
export function installErrorHandlers(target: ErrorTarget, reporter: CrashReporter): void {
  target.addEventListener('error', (event) => {
    // A failed image or script has no error object and no message: nothing to report.
    if (event.error === undefined && !event.message) return;
    reporter.reportFailure(event.error ?? event.message, 'error');
  });
  target.addEventListener('unhandledrejection', (event) => {
    reporter.reportFailure(event.reason, 'rejection');
  });
}

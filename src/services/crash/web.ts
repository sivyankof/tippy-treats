import { describeError } from './describe';
import type { CrashContext, CrashService } from './types';

/**
 * Browser stand-in for Crashlytics: prints `[crash] kind scene message` to the console in the dev
 * build and stays silent in a production build. `enabled` and `sink` are for tests.
 */
export class WebCrash implements CrashService {
  constructor(
    private readonly enabled: boolean = import.meta.env.DEV,
    private readonly sink: (...args: unknown[]) => void = (...args) => console.info(...args),
  ) {}

  recordError(error: unknown, context: CrashContext): void {
    if (!this.enabled) return;
    this.sink(
      `[crash] ${context.kind} (${context.scene || 'no scene'})`,
      describeError(error).message,
    );
  }

  crash(): void {
    // Nothing to crash in a browser.
  }
}

import { describeError, type Frame } from './describe';
import type { CrashContext, CrashService } from './types';

/** What the game needs of `@capacitor-firebase/crashlytics` (injected, so tests run without the app). */
export interface CrashPlugin {
  recordException(options: { message: string; stacktrace?: Frame[] }): Promise<void>;
  setCustomKey(options: {
    key: string;
    value: string | number;
    type: 'string' | 'int';
  }): Promise<void>;
  crash(options: { message: string }): Promise<void>;
}

const ignore = (): undefined => undefined;

/** The text of the forced crash of the debug menu. */
const TEST_CRASH_MESSAGE = 'Test crash from the debug menu';

/**
 * Firebase Crashlytics (docs/09-services-analytics.md, section 7). The scene and the save version
 * go in as custom keys before the non-fatal report (they work on both systems; the keys of the
 * report itself are ignored on iOS when a stack comes with it). Every call is fire and forget:
 * a rejection or a throw is dropped, so reporting a failure can never cause one.
 */
export class NativeCrash implements CrashService {
  constructor(private readonly plugin: CrashPlugin) {}

  recordError(error: unknown, context: CrashContext): void {
    this.send(() =>
      this.plugin.setCustomKey({ key: 'scene', value: context.scene || 'none', type: 'string' }),
    );
    this.send(() =>
      this.plugin.setCustomKey({ key: 'save_version', value: context.saveVersion, type: 'int' }),
    );
    this.send(() =>
      this.plugin.setCustomKey({ key: 'report_kind', value: context.kind, type: 'string' }),
    );
    const { message, frames } = describeError(error);
    this.send(() =>
      this.plugin.recordException({
        message,
        ...(frames.length > 0 ? { stacktrace: frames } : {}),
      }),
    );
  }

  crash(): void {
    this.send(() => this.plugin.crash({ message: TEST_CRASH_MESSAGE }));
  }

  private send(call: () => Promise<void>): void {
    try {
      call().catch(ignore);
    } catch {
      // A plugin that throws at once is as harmless as one that rejects.
    }
  }
}

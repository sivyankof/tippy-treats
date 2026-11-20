import type { AnalyticsService, EventParams } from './types';
import { checkEvent, checkProperty } from './validate';

/** What the game needs of `@capacitor-firebase/analytics` (injected, so tests run without the app). */
export interface AnalyticsPlugin {
  logEvent(options: { name: string; params?: Record<string, string | number> }): Promise<void>;
  setUserProperty(options: { key: string; value: string | null }): Promise<void>;
}

const ignore = (): undefined => undefined;

/**
 * Firebase Analytics (docs/09-services-analytics.md, section 6). Every call is fire and forget:
 * a rejected promise (blocked Firebase domains, a plugin that is not configured) and a throw are
 * dropped without a trace, so the game never sees them. Names and values are checked first
 * (`checkEvent`): what Firebase would refuse is dropped here, and `warn` hears about it (the dev
 * console and the debug log; production passes nothing). No user id and no install id is ever set.
 */
export class NativeAnalytics implements AnalyticsService {
  constructor(
    private readonly plugin: AnalyticsPlugin,
    private readonly warn: (message: string) => void = ignore,
  ) {}

  logEvent(name: string, params?: EventParams): void {
    const checked = checkEvent(name, params);
    for (const problem of checked.problems) this.warn(problem);
    if (checked.name === null) return;
    this.send(() => this.plugin.logEvent({ name: checked.name ?? name, params: checked.params }));
  }

  setUserProperty(name: string, value: string): void {
    const checked = checkProperty(name, value);
    for (const problem of checked.problems) this.warn(problem);
    if (checked.name === null) return;
    this.send(() =>
      this.plugin.setUserProperty({ key: checked.name ?? name, value: checked.value }),
    );
  }

  private send(call: () => Promise<void>): void {
    try {
      call().catch(ignore);
    } catch {
      // A plugin that throws at once is as harmless as one that rejects.
    }
  }
}

import type { AnalyticsService, EventParams } from './types';

/**
 * Browser stand-in for the analytics SDK: prints `[telemetry] name {params}` to the console in
 * the dev build and stays silent in a production build. `enabled` and `sink` are for tests.
 */
export class WebAnalytics implements AnalyticsService {
  constructor(
    private readonly enabled: boolean = import.meta.env.DEV,
    private readonly sink: (...args: unknown[]) => void = (...args) => console.info(...args),
  ) {}

  logEvent(name: string, params?: EventParams): void {
    if (!this.enabled) return;
    this.sink(`[telemetry] ${name}`, params ?? {});
  }

  setUserProperty(name: string, value: string): void {
    if (!this.enabled) return;
    this.sink(`[telemetry] property ${name}`, value);
  }
}

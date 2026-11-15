/** Parameters of an event: flat values only, no personal data (docs/09-services-analytics.md, section 6). */
export type EventParams = Record<string, string | number | boolean>;

/** Event analytics of the game; the game decides what to log, the service only delivers it. */
export interface AnalyticsService {
  logEvent(name: string, params?: EventParams): void;
  setUserProperty(name: string, value: string): void;
}

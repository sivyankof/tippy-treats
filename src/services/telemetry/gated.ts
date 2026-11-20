import { TELEMETRY } from '../../data/app/telemetry';
import { fireAndForget } from '../common/fire-and-forget';
import type { AnalyticsDecision } from './consent-gate';
import type { AnalyticsService, EventParams } from './types';

/** Turns the collection of Firebase Analytics on or off (`FirebaseAnalytics.setEnabled`). */
export type SetCollection = (enabled: boolean) => Promise<void>;

/**
 * Analytics behind the consent decision (docs/09-services-analytics.md, section 6). Until the
 * decision is known the events and user properties wait in memory (at most
 * `TELEMETRY.pendingEvents` events, the oldest dropped); "on" turns the collection on and sends
 * them, "off" turns it off and drops them. The decision may change later (the privacy options
 * form) either way; an "unknown" never undoes a decision already made.
 */
export class GatedAnalytics implements AnalyticsService {
  private state: 'pending' | 'on' | 'off' = 'pending';
  private readonly events: Array<{ name: string; params?: EventParams }> = [];
  private readonly properties = new Map<string, string>();

  constructor(
    private readonly inner: AnalyticsService,
    private readonly setCollection: SetCollection,
    private readonly pendingMax: number = TELEMETRY.pendingEvents,
  ) {}

  /** Where the decision stands now (for the debug log and tests). */
  get decision(): 'pending' | 'on' | 'off' {
    return this.state;
  }

  decide(decision: AnalyticsDecision): void {
    if (decision === 'unknown' || decision === this.state) return;
    this.state = decision;
    fireAndForget(() => this.setCollection(decision === 'on'));
    if (decision === 'on') {
      for (const [name, value] of this.properties) this.inner.setUserProperty(name, value);
      for (const { name, params } of this.events) this.inner.logEvent(name, params);
    }
    this.properties.clear();
    this.events.length = 0;
  }

  logEvent(name: string, params?: EventParams): void {
    if (this.state === 'on') this.inner.logEvent(name, params);
    else if (this.state === 'pending') {
      this.events.push({ name, params });
      if (this.events.length > this.pendingMax) this.events.shift();
    }
  }

  setUserProperty(name: string, value: string): void {
    if (this.state === 'on') this.inner.setUserProperty(name, value);
    else if (this.state === 'pending') this.properties.set(name, value);
  }
}

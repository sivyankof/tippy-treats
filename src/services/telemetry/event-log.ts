import { TELEMETRY_LOG } from '../../data/debug/telemetry-log';
import type { AnalyticsService, EventParams } from './types';

/** The last events the game sent, newest last; the debug menu of the internal build shows them. */
export class TelemetryLog {
  private readonly lines: string[] = [];

  constructor(private readonly size: number = TELEMETRY_LOG.lines) {}

  add(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.size) this.lines.splice(0, this.lines.length - this.size);
  }

  /** The last `count` lines, oldest first. */
  last(count: number = this.size): string[] {
    return this.lines.slice(-count);
  }

  clear(): void {
    this.lines.length = 0;
  }
}

/** The text of one event as the debug menu shows it. */
export function eventLine(name: string, params?: EventParams): string {
  const pairs = Object.entries(params ?? {}).map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length > 0 ? `${name} ${pairs.join(' ')}` : name;
}

/** Writes every event to the log, then hands it on to the real service (debug builds only). */
export class LoggedAnalytics implements AnalyticsService {
  constructor(
    private readonly inner: AnalyticsService,
    private readonly log: TelemetryLog,
  ) {}

  logEvent(name: string, params?: EventParams): void {
    this.log.add(eventLine(name, params));
    this.inner.logEvent(name, params);
  }

  setUserProperty(name: string, value: string): void {
    this.log.add(`property ${name}=${value}`);
    this.inner.setUserProperty(name, value);
  }
}

/** The log of this page load. */
export const telemetryLog = new TelemetryLog();

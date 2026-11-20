import { describe, expect, it, vi } from 'vitest';
import { eventLine, LoggedAnalytics, TelemetryLog } from './event-log';

describe('TelemetryLog', () => {
  it('keeps the last lines only', () => {
    const log = new TelemetryLog(3);
    for (const line of ['a', 'b', 'c', 'd']) log.add(line);
    expect(log.last()).toEqual(['b', 'c', 'd']);
    expect(log.last(2)).toEqual(['c', 'd']);
    log.clear();
    expect(log.last()).toEqual([]);
  });
});

describe('LoggedAnalytics', () => {
  it('logs and forwards events and properties', () => {
    const inner = { logEvent: vi.fn(), setUserProperty: vi.fn() };
    const log = new TelemetryLog();
    const analytics = new LoggedAnalytics(inner, log);
    analytics.logEvent('run_end', { height: 12, mode: 'classic' });
    analytics.logEvent('mission_chest');
    analytics.setUserProperty('payer', '0');
    expect(log.last()).toEqual([
      'run_end height=12 mode=classic',
      'mission_chest',
      'property payer=0',
    ]);
    expect(inner.logEvent).toHaveBeenCalledWith('run_end', { height: 12, mode: 'classic' });
    expect(inner.setUserProperty).toHaveBeenCalledWith('payer', '0');
  });

  it('formats an event without parameters as its name', () => {
    expect(eventLine('x')).toBe('x');
  });
});

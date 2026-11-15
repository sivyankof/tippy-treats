import { describe, expect, it, vi } from 'vitest';
import { WebAnalytics } from './web';

describe('WebAnalytics', () => {
  it('prints events in dev', () => {
    const sink = vi.fn();
    const analytics = new WebAnalytics(true, sink);
    analytics.logEvent('checkpoint_start', { height: 20 });
    analytics.logEvent('run_end');
    analytics.setUserProperty('payer', '0');
    expect(sink).toHaveBeenNthCalledWith(1, '[telemetry] checkpoint_start', { height: 20 });
    expect(sink).toHaveBeenNthCalledWith(2, '[telemetry] run_end', {});
    expect(sink).toHaveBeenNthCalledWith(3, '[telemetry] property payer', '0');
  });

  it('is silent in production', () => {
    const sink = vi.fn();
    const analytics = new WebAnalytics(false, sink);
    analytics.logEvent('run_start', { mode: 'classic' });
    analytics.setUserProperty('payer', '1');
    expect(sink).not.toHaveBeenCalled();
  });
});

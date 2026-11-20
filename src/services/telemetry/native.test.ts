import { describe, expect, it, vi } from 'vitest';
import { NativeAnalytics, type AnalyticsPlugin } from './native';

function fakePlugin(): AnalyticsPlugin & {
  logEvent: ReturnType<typeof vi.fn>;
  setUserProperty: ReturnType<typeof vi.fn>;
} {
  return {
    logEvent: vi.fn(() => Promise.resolve()),
    setUserProperty: vi.fn(() => Promise.resolve()),
  };
}

describe('NativeAnalytics', () => {
  it('sends a checked event with its parameters', () => {
    const plugin = fakePlugin();
    new NativeAnalytics(plugin).logEvent('checkpoint_start', { height: 20, flag: true });
    expect(plugin.logEvent).toHaveBeenCalledWith({
      name: 'checkpoint_start',
      params: { height: 20, flag: 1 },
    });
  });

  it('drops an event with a bad name and tells the warner', () => {
    const plugin = fakePlugin();
    const warn = vi.fn();
    new NativeAnalytics(plugin, warn).logEvent('Bad Name');
    expect(plugin.logEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('sends the rest when one parameter is refused', () => {
    const plugin = fakePlugin();
    const warn = vi.fn();
    new NativeAnalytics(plugin, warn).logEvent('x', { ok: 1, 'No Good': 2 });
    expect(plugin.logEvent).toHaveBeenCalledWith({ name: 'x', params: { ok: 1 } });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('sets a user property', () => {
    const plugin = fakePlugin();
    new NativeAnalytics(plugin).setUserProperty('payer', '1');
    expect(plugin.setUserProperty).toHaveBeenCalledWith({ key: 'payer', value: '1' });
  });

  it('refuses a property whose name is too long', () => {
    const plugin = fakePlugin();
    new NativeAnalytics(plugin).setUserProperty('days_since_install_bucket', '1');
    expect(plugin.setUserProperty).not.toHaveBeenCalled();
  });

  it('swallows a rejected promise: no unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const plugin: AnalyticsPlugin = {
      logEvent: () => Promise.reject(new Error('blocked')),
      setUserProperty: () => Promise.reject(new Error('blocked')),
    };
    const analytics = new NativeAnalytics(plugin);
    analytics.logEvent('run_start');
    analytics.setUserProperty('payer', '0');
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('swallows a plugin that throws at once', () => {
    const plugin: AnalyticsPlugin = {
      logEvent: () => {
        throw new Error('no bridge');
      },
      setUserProperty: () => {
        throw new Error('no bridge');
      },
    };
    const analytics = new NativeAnalytics(plugin);
    expect(() => analytics.logEvent('run_start')).not.toThrow();
    expect(() => analytics.setUserProperty('payer', '0')).not.toThrow();
  });
});

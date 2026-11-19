import { describe, expect, it, vi } from 'vitest';
import { type AppPlugin, NativeAppShell, type SplashPlugin } from './native';

type Listener = (state: { isActive: boolean }) => void;

function fakeApp() {
  const listeners = new Map<string, Listener>();
  const removed: string[] = [];
  const app = {
    addListener: vi.fn((event: string, callback: Listener) => {
      listeners.set(event, callback);
      return Promise.resolve({
        remove: () => {
          removed.push(event);
          return Promise.resolve();
        },
      });
    }),
    minimizeApp: vi.fn(() => Promise.resolve()),
  };
  return { app: app as unknown as AppPlugin, raw: app, listeners, removed };
}

const splash = (): SplashPlugin & { hide: ReturnType<typeof vi.fn> } => ({
  hide: vi.fn(() => Promise.resolve()),
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('NativeAppShell', () => {
  it('passes the active state of the app on', async () => {
    const fake = fakeApp();
    const shell = new NativeAppShell(fake.app, splash());
    const seen: boolean[] = [];
    shell.onActiveChange((active) => seen.push(active));
    await flush();
    fake.listeners.get('appStateChange')?.({ isActive: false });
    fake.listeners.get('appStateChange')?.({ isActive: true });
    expect(seen).toEqual([false, true]);
  });

  it('removes a listener, also one stopped before the plugin answered', async () => {
    const fake = fakeApp();
    const shell = new NativeAppShell(fake.app, splash());
    const stop = shell.onBack(() => undefined);
    stop();
    await flush();
    expect(fake.removed).toEqual(['backButton']);
    const stopLater = shell.onActiveChange(() => undefined);
    await flush();
    stopLater();
    stopLater();
    await flush();
    expect(fake.removed).toEqual(['backButton', 'appStateChange']);
  });

  it('hides the splash once', () => {
    const plugin = splash();
    const shell = new NativeAppShell(fakeApp().app, plugin);
    shell.hideSplash();
    shell.hideSplash();
    expect(plugin.hide).toHaveBeenCalledTimes(1);
  });

  it('minimizes the app and survives a plugin that fails', async () => {
    const fake = fakeApp();
    fake.raw.minimizeApp.mockImplementation(() => Promise.reject(new Error('ios')));
    new NativeAppShell(fake.app, splash()).minimize();
    await flush();
    expect(fake.raw.minimizeApp).toHaveBeenCalled();
  });
});

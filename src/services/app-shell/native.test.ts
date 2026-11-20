import { describe, expect, it, vi } from 'vitest';
import { type AppPlugin, type BarsPlugin, NativeAppShell, type SplashPlugin } from './native';

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

const bars = (): BarsPlugin & { setStyle: ReturnType<typeof vi.fn> } => ({
  setStyle: vi.fn(() => Promise.resolve()),
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('NativeAppShell', () => {
  it('passes the active state of the app on', async () => {
    const fake = fakeApp();
    const shell = new NativeAppShell(fake.app, splash(), bars());
    const seen: boolean[] = [];
    shell.onActiveChange((active) => seen.push(active));
    await flush();
    fake.listeners.get('appStateChange')?.({ isActive: false });
    fake.listeners.get('appStateChange')?.({ isActive: true });
    expect(seen).toEqual([false, true]);
  });

  it('removes a listener, also one stopped before the plugin answered', async () => {
    const fake = fakeApp();
    const shell = new NativeAppShell(fake.app, splash(), bars());
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
    const shell = new NativeAppShell(fakeApp().app, plugin, bars());
    shell.hideSplash();
    shell.hideSplash();
    expect(plugin.hide).toHaveBeenCalledTimes(1);
  });

  it('minimizes the app and survives a plugin that fails', async () => {
    const fake = fakeApp();
    fake.raw.minimizeApp.mockImplementation(() => Promise.reject(new Error('ios')));
    new NativeAppShell(fake.app, splash(), bars()).minimize();
    await flush();
    expect(fake.raw.minimizeApp).toHaveBeenCalled();
  });

  it('sets the status bar icons only when they change, on the status bar alone', async () => {
    const plugin = bars();
    const shell = new NativeAppShell(fakeApp().app, splash(), plugin);
    shell.setBarIcons('light');
    shell.setBarIcons('light');
    shell.setBarIcons('dark');
    expect(plugin.setStyle.mock.calls).toEqual([
      [{ style: 'DARK', bar: 'StatusBar' }],
      [{ style: 'LIGHT', bar: 'StatusBar' }],
    ]);
    plugin.setStyle.mockImplementation(() => Promise.reject(new Error('old webview')));
    shell.setBarIcons('light');
    await flush();
    expect(plugin.setStyle).toHaveBeenCalledTimes(3);
  });

  it('sends the web view to an outside address (the shell hands it to the system browser)', () => {
    const went: string[] = [];
    const shell = new NativeAppShell(fakeApp().app, splash(), bars(), (url) => went.push(url));
    shell.openExternal('https://sivyankof.github.io/tippy-treats-site/privacy.html?lang=ru');
    expect(went).toEqual(['https://sivyankof.github.io/tippy-treats-site/privacy.html?lang=ru']);
  });
});

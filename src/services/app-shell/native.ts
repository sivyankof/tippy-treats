import { SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { pageUserAgent, parseUserAgent } from './device-info';
import type { AppShellService, BarIcons, DeviceInfo } from './types';

/** A listener handle of a Capacitor plugin. */
interface ListenerHandle {
  remove(): Promise<void>;
}

/** What the shell needs of `@capacitor/app` (injected, so tests run without the app). */
export interface AppPlugin {
  addListener(
    event: 'appStateChange',
    callback: (state: { isActive: boolean }) => void,
  ): Promise<ListenerHandle>;
  addListener(event: 'backButton', callback: () => void): Promise<ListenerHandle>;
  minimizeApp(): Promise<void>;
  getInfo(): Promise<{ build: string }>;
}

/** What the shell needs of `@capacitor/splash-screen`. */
export interface SplashPlugin {
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
}

/** What the shell needs of `SystemBars` of the Capacitor core. */
export interface BarsPlugin {
  setStyle(options: { style: SystemBarsStyle; bar?: SystemBarType }): Promise<void>;
}

/** `DARK` is the style for a dark background: light icons. */
const BAR_STYLE: Record<BarIcons, SystemBarsStyle> = {
  light: SystemBarsStyle.Dark,
  dark: SystemBarsStyle.Light,
};

/** What the game needs of the project's own plugin `TippyDevice` (Swift and Java sides in `ios/` and `android/`). */
export interface DevicePlugin {
  get(): Promise<{ model: string; osVersion: string; platform: string }>;
}

const PLATFORM_NAMES: Record<string, string> = { ios: 'iOS', android: 'Android' };

const ignore = (): undefined => undefined;

/** Subscribes through a plugin whose handle comes later; the returned function works before it does. */
function subscribe(add: () => Promise<ListenerHandle>): () => void {
  let removed = false;
  let handle: ListenerHandle | null = null;
  add()
    .then((ready) => {
      handle = ready;
      if (removed) ready.remove().catch(ignore);
    })
    .catch(ignore);
  return () => {
    if (removed) return;
    removed = true;
    handle?.remove().catch(ignore);
  };
}

/** The iOS and Android app (`@capacitor/app`, `@capacitor/splash-screen`, `SystemBars`). */
export class NativeAppShell implements AppShellService {
  readonly native = true;
  private splashHidden = false;
  /** The icons last asked for; `null` until the game first asks (the launch style from the config stands). */
  private barIcons: BarIcons | null = null;

  constructor(
    private readonly app: AppPlugin,
    private readonly splash: SplashPlugin,
    private readonly bars: BarsPlugin,
    /** Sends the web view to an address (injected in tests). */
    private readonly navigate: (url: string) => void = (url) => globalThis.location?.assign(url),
    /** The plugin that knows the model; without it, or when it fails, the user agent is read. */
    private readonly device: DevicePlugin | null = null,
    private readonly userAgent: () => string = pageUserAgent,
  ) {}

  onActiveChange(callback: (active: boolean) => void): () => void {
    return subscribe(() =>
      this.app.addListener('appStateChange', (state) => callback(state.isActive)),
    );
  }

  onBack(callback: () => void): () => void {
    return subscribe(() => this.app.addListener('backButton', () => callback()));
  }

  minimize(): void {
    this.app.minimizeApp().catch(ignore);
  }

  hideSplash(): void {
    if (this.splashHidden) return;
    this.splashHidden = true;
    this.splash.hide().catch(ignore);
  }

  /**
   * The web view is sent to the address; the Capacitor shell does not load an outside address
   * itself but hands it to the system (iOS `UIApplication.open`, Android `ACTION_VIEW`), so the
   * page opens in the browser and the game stays where it is.
   */
  openExternal(url: string): void {
    this.navigate(url);
  }

  async deviceInfo(): Promise<DeviceInfo> {
    try {
      const info = await this.device?.get();
      if (info?.model) {
        const platform = PLATFORM_NAMES[info.platform.toLowerCase()] ?? info.platform;
        return { model: info.model, os: `${platform} ${info.osVersion}`.trim() };
      }
    } catch {
      // The plugin is missing or failed: the user agent tells what it can.
    }
    return parseUserAgent(this.userAgent());
  }

  async appBuild(): Promise<string | null> {
    try {
      return (await this.app.getInfo()).build || null;
    } catch {
      return null;
    }
  }

  setBarIcons(icons: BarIcons): void {
    if (icons === this.barIcons) return;
    this.barIcons = icons;
    this.bars.setStyle({ style: BAR_STYLE[icons], bar: SystemBarType.StatusBar }).catch(ignore);
  }
}

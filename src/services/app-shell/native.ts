import { SystemBarsStyle, SystemBarType } from '@capacitor/core';
import type { AppShellService, BarIcons } from './types';

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

  setBarIcons(icons: BarIcons): void {
    if (icons === this.barIcons) return;
    this.barIcons = icons;
    this.bars.setStyle({ style: BAR_STYLE[icons], bar: SystemBarType.StatusBar }).catch(ignore);
  }
}

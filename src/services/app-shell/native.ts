import type { AppShellService } from './types';

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

/** The iOS and Android app (`@capacitor/app`, `@capacitor/splash-screen`). */
export class NativeAppShell implements AppShellService {
  readonly native = true;
  private splashHidden = false;

  constructor(
    private readonly app: AppPlugin,
    private readonly splash: SplashPlugin,
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
}

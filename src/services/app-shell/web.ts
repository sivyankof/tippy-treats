import { pageUserAgent, parseUserAgent } from './device-info';
import type { AppShellService, DeviceInfo } from './types';

const nothing = (): void => undefined;

/** The browser has no shell: nothing to listen to, nothing to hide. */
export class WebAppShell implements AppShellService {
  readonly native = false;

  onActiveChange(): () => void {
    return nothing;
  }

  onBack(): () => void {
    return nothing;
  }

  minimize(): void {}

  hideSplash(): void {}

  setBarIcons(): void {}

  openExternal(url: string): void {
    // A mail address opens the mail program in place; a new tab for it would stay blank.
    if (url.startsWith('mailto:')) globalThis.location?.assign(url);
    else globalThis.open?.(url, '_blank', 'noopener');
  }

  deviceInfo(): Promise<DeviceInfo> {
    return Promise.resolve(parseUserAgent(pageUserAgent()));
  }

  appBuild(): Promise<string | null> {
    return Promise.resolve(null);
  }
}

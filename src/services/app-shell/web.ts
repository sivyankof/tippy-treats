import type { AppShellService } from './types';

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
}

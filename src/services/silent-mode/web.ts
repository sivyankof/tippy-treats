import type { SilentModeService } from './types';

/** Browser stub: a page cannot read the silent switch, so it is never silent. The native reading comes in M7. */
export class WebSilentMode implements SilentModeService {
  isSilent(): boolean {
    return false;
  }

  onChange(): () => void {
    return () => undefined;
  }
}

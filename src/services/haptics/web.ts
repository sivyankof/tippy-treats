import { HAPTICS } from '../../data/haptics';
import type { HapticKind, HapticsService } from './types';

type VibrateFn = (pattern: number[]) => boolean;

/** Browser stub: `navigator.vibrate` when the browser has it, otherwise silent. */
export class WebHaptics implements HapticsService {
  enabled = true;
  private readonly vibrate: VibrateFn | undefined;

  constructor(vibrate?: VibrateFn) {
    this.vibrate = vibrate ?? WebHaptics.detect();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  play(kind: HapticKind): void {
    if (!this.enabled || !this.vibrate) return;
    try {
      this.vibrate([...HAPTICS.patterns[kind]]);
    } catch {
      // Some browsers block vibration before a user gesture.
    }
  }

  private static detect(): VibrateFn | undefined {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return undefined;
    }
    return (pattern) => navigator.vibrate(pattern);
  }
}

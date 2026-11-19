import { HAPTICS } from '../../data/app/haptics';
import { SwitchableHaptics } from './switchable';
import type { HapticKind } from './types';

type VibrateFn = (pattern: number[]) => boolean;

/** Browser stub: `navigator.vibrate` when the browser has it, otherwise silent. */
export class WebHaptics extends SwitchableHaptics {
  private readonly vibrate: VibrateFn | undefined;

  constructor(vibrate?: VibrateFn) {
    super();
    this.vibrate = vibrate ?? WebHaptics.detect();
  }

  protected emit(kind: HapticKind): void {
    this.vibrate?.([...HAPTICS.patterns[kind]]);
  }

  private static detect(): VibrateFn | undefined {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return undefined;
    }
    return (pattern) => navigator.vibrate(pattern);
  }
}

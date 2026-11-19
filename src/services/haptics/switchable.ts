import type { HapticKind, HapticsService } from './types';

/** The player's vibration switch shared by the browser and the native haptics; a failing effect never breaks the game. */
export abstract class SwitchableHaptics implements HapticsService {
  enabled = true;

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  play(kind: HapticKind): void {
    if (!this.enabled) return;
    try {
      this.emit(kind);
    } catch {
      // Some browsers block vibration before a user gesture; a plugin may be missing.
    }
  }

  /** Plays the effect; called only while vibration is on. */
  protected abstract emit(kind: HapticKind): void;
}

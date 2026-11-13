/** Haptic effects of the game, see docs/06-art-animation-audio.md section 8. */
export type HapticKind =
  'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error' | 'triple';

/** Vibration feedback. Native and browser implementations share this interface. */
export interface HapticsService {
  /** Whether the player has vibration turned on. */
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** Plays an effect; does nothing when disabled or unsupported. */
  play(kind: HapticKind): void;
}

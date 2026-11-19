/**
 * The silent switch of the device. Sound follows it: while it is on, the audio is held back
 * (`AudioService.suspend('silent')`, wired in `game/audio/audio-lifecycle.ts`).
 */
export interface SilentModeService {
  isSilent(): boolean;
  /** Calls `callback` with the new state whenever it changes; returns the function that stops it. */
  onChange(callback: (silent: boolean) => void): () => void;
}

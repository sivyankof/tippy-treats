import type { AudioService } from '../../services/audio/types';

/** Native events that count as a user gesture for the browser's audio policy. */
const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

/**
 * Unlocks the audio from user gestures: native listeners, so the call runs inside the gesture
 * itself, not from a queue of frames. The listeners live as long as the page.
 */
export function bindAudioUnlock(audio: AudioService): void {
  // A tap also lets a track that did not start (a refused play) try again.
  const unlock = (): void => {
    audio.unlock();
    audio.music.gesture();
  };
  for (const type of GESTURE_EVENTS) window.addEventListener(type, unlock, { passive: true });
}

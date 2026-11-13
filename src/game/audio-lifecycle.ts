import * as Phaser from 'phaser';
import type { AudioService } from '../services/audio/types';

/** Native events that count as a user gesture for the browser's audio policy. */
const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

/**
 * Ties the audio service to the page: unlocks it from the first user gesture (native listeners,
 * so the call runs inside the gesture itself) and suspends it while the game is hidden.
 * Call once at start-up; the listeners live as long as the page.
 */
export function bindAudioLifecycle(game: Phaser.Game, audio: AudioService): void {
  const unlock = (): void => audio.unlock();
  for (const type of GESTURE_EVENTS) window.addEventListener(type, unlock, { passive: true });
  game.events.on(Phaser.Core.Events.HIDDEN, () => audio.suspend());
  game.events.on(Phaser.Core.Events.VISIBLE, () => audio.resume());
}

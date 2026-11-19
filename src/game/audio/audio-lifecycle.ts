import * as Phaser from 'phaser';
import type { AudioService } from '../../services/audio/types';
import { bindAudioUnlock } from './audio-unlock';
import type { SilentModeService } from '../../services/silent-mode/types';

/**
 * Ties the audio service to the page: unlocks it from the first user gesture (`audio-unlock.ts`), suspends it while the game is hidden and while the
 * device is in silent mode.
 * Call once at start-up; the listeners live as long as the page.
 */
export function bindAudioLifecycle(
  game: Phaser.Game,
  audio: AudioService,
  silentMode: SilentModeService,
): void {
  bindAudioUnlock(audio);
  game.events.on(Phaser.Core.Events.HIDDEN, () => audio.suspend('app'));
  game.events.on(Phaser.Core.Events.VISIBLE, () => audio.resume('app'));
  const follow = (silent: boolean): void =>
    silent ? audio.suspend('silent') : audio.resume('silent');
  if (silentMode.isSilent()) follow(true);
  silentMode.onChange(follow);
}

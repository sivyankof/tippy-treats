import * as Phaser from 'phaser';
import type { AudioService } from '../../services/audio/types';
import { bindAudioUnlock } from './audio-unlock';
import { audioLog } from '../../services/audio/audio-log';
import type { SilentModeService } from '../../services/silent-mode/types';

/**
 * Ties the audio service to the page: unlocks it from the first user gesture (`audio-unlock.ts`),
 * suspends it while the device is in silent mode and, in a browser, while the page is hidden (in
 * the app the shell does that alone, on the app's active state: `native-shell.ts`).
 * Call once at start-up; the listeners live as long as the page.
 */
export function bindAudioLifecycle(
  game: Phaser.Game,
  audio: AudioService,
  silentMode: SilentModeService,
  /** False in the app: there the shell alone holds and lets go the sound (`native-shell.ts`). */
  pageDrivesAudio = true,
): void {
  bindAudioUnlock(audio);
  if (pageDrivesAudio) bindPageAudio(game, audio);
  const follow = (silent: boolean): void =>
    silent ? audio.suspend('silent') : audio.resume('silent');
  if (silentMode.isSilent()) follow(true);
  silentMode.onChange(follow);
}

/** In a browser the sound stops while the page is hidden and comes back when it shows. */
function bindPageAudio(game: Phaser.Game, audio: AudioService): void {
  game.events.on(Phaser.Core.Events.HIDDEN, () => {
    audioLog.add(`game hidden (page ${document.visibilityState})`);
    audio.suspend('app');
  });
  game.events.on(Phaser.Core.Events.VISIBLE, () => {
    audioLog.add(`game visible (page ${document.visibilityState})`);
    audio.resume('app');
  });
}

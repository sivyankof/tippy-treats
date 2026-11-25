import * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService } from '../../services/app-shell/types';
import type { AudioService } from '../../services/audio/types';
import { handleBack } from './back-stack';
import { onFirstScreen } from './boot/first-screen';
import { followStatusBar } from './status-bar';
import { audioLog } from '../../services/audio/audio-log';

/** What the shell needs of the state: the save is written at once when the app leaves. */
interface Flushable {
  flush(): void;
}

/**
 * Ties the iOS and Android app to the game (docs/09-services-analytics.md, section 1). The app
 * stopping being active (background, a call, the control centre) pauses the game the way a hidden
 * page does (`Phaser.Core.Events.HIDDEN`: the loop stops, a run shows its pause window) and
 * writes the save at once; in the app the shell alone holds the sound then (`audio.suspend('app')`,
 * the page's visibility does not touch it). Active again: the loop goes on and the sound is let go
 * at once (`audio.resume('app')`); the service then checks the context by its clock and mends it
 * step by step (`services/audio/context-health.ts`). The app may play sound without a gesture, so
 * the audio starts right away, and the playlist with the first screen if that screen asked for no
 * music itself. The boot screen of index.html takes the launch splash away once it is painted; the
 * shell hides it again after the first frame of a screen of the game, in case the page could not. The Android back goes to the topmost screen or window that takes it
 * (`back-stack.ts`: a window closes, a run pauses, a menu screen goes home); when none does (Home),
 * the app goes to the background. The status bar icons follow the screen (`status-bar.ts`). Does
 * nothing in a browser.
 */
export function bindNativeShell(
  game: Phaser.Game,
  shell: AppShellService,
  audio: AudioService,
  state: Flushable,
): void {
  if (!shell.native) return;
  let pausedByShell = false;
  shell.onActiveChange((active) => {
    audioLog.add(
      `app ${active ? 'active' : 'inactive'}${pausedByShell ? ' (paused by shell)' : ''}`,
    );
    if (!active) {
      state.flush();
      // In the app only the shell holds and lets go the sound (not the page's visibility).
      audio.suspend('app');
      if (!pausedByShell) {
        pausedByShell = true;
        game.events.emit(Phaser.Core.Events.HIDDEN);
      }
      return;
    }
    if (pausedByShell) {
      pausedByShell = false;
      game.events.emit(Phaser.Core.Events.VISIBLE);
    }
    // Active again: the native side has woken the audio session first (AppDelegate). The service
    // checks the context by its clock after this and mends it (services/audio/context-health.ts).
    audio.resume('app');
  });
  shell.onBack(() => {
    if (!handleBack()) shell.minimize();
  });
  audio.unlock();
  hideSplashOnFirstScreen(game, shell);
  startMusicOnFirstScreen(game, audio);
  followStatusBar(shell);
}

function hideSplashOnFirstScreen(game: Phaser.Game, shell: AppShellService): void {
  const fallback = setTimeout(() => hide(), APP_SHELL.splashMaxMs);
  const hide = onFirstScreen(game, () => {
    clearTimeout(fallback);
    shell.hideSplash();
  });
}

/**
 * The app may play without a gesture: the playlist starts with the first screen. A menu screen asks
 * for it itself; the tutorial run of a first launch asked late or not at all (docs/06, section 7,
 * "Запуск"). A screen that already asked for something (a track of its own, the playlist) keeps it.
 */
function startMusicOnFirstScreen(game: Phaser.Game, audio: AudioService): void {
  onFirstScreen(game, () => {
    const asked = audio.music.state();
    if (asked.track === null && !asked.playlist) audio.music.playlist();
  });
}

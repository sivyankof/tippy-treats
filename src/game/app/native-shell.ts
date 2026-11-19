import * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService } from '../../services/app-shell/types';
import type { AudioService } from '../../services/audio/types';
import { SCENES } from './scene-keys';

/** What the shell needs of the state: the save is written at once when the app leaves. */
interface Flushable {
  flush(): void;
}

/**
 * Ties the iOS and Android app to the game (docs/09-services-analytics.md, section 1). The app
 * stopping being active (background, a call, the control centre) pauses the game the way a hidden
 * page does (`Phaser.Core.Events.HIDDEN`: the loop stops, a run shows its pause window, the sound
 * and music stop) and writes the save at once; coming back resumes the loop and asks the audio to
 * run again a little later, since a call or an alarm may still hold it. The app may play sound
 * without a gesture, so the audio starts right away. The launch splash goes away after the first
 * frame of a screen of the game. Does nothing in a browser.
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
    if (!active) {
      state.flush();
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
    setTimeout(() => audio.unlock(), APP_SHELL.audioRetryMs);
  });
  audio.unlock();
  hideSplashOnFirstScreen(game, shell);
}

function hideSplashOnFirstScreen(game: Phaser.Game, shell: AppShellService): void {
  const fallback = setTimeout(done, APP_SHELL.splashMaxMs);
  function shown(): void {
    const screen = game.scene.getScenes(true).some((scene) => scene.scene.key !== SCENES.boot);
    if (screen) done();
  }
  function done(): void {
    clearTimeout(fallback);
    game.events.off(Phaser.Core.Events.POST_RENDER, shown);
    shell.hideSplash();
  }
  game.events.on(Phaser.Core.Events.POST_RENDER, shown);
}

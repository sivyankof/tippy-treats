import * as Phaser from 'phaser';
import { musicAskFor, type MusicCue } from '../data/music';
import { services } from '../services';
import { HoldCount } from '../util/hold-count';
import { SCENES } from './scene-keys';

/**
 * Where the game tells the music what to play (docs/06-art-animation-audio.md, section 7,
 * "Музыка"): the playlist everywhere, the daily tower's track for its whole run, the record track
 * while the results with a new record are up. The zones, a miss, "one more run" and the screens
 * in between ask nothing new (asking for what plays changes nothing). The run's pause window stops
 * the music where it is. Calls before the first tap are remembered by the music proxy.
 */

/** Asks the music for what `cue` wants (nothing when the cue keeps the music as it is). */
export function cueMusic(cue: MusicCue): void {
  const ask = musicAskFor(cue);
  if (!ask) return;
  const { music } = services.audio;
  if (ask.kind === 'playlist') music.playlist();
  else music.play(ask.track);
}

/** A menu screen is up: the playlist (it goes on untouched if it plays). */
export function playMenuMusic(): void {
  cueMusic({ kind: 'menu' });
}

/** Every screen that is not the run or the results. */
const MENU_SCENES = [
  SCENES.home,
  SCENES.team,
  SCENES.collection,
  SCENES.creatureDetail,
  SCENES.daily,
  SCENES.shop,
  SCENES.newCreature,
  SCENES.lineup,
] as const;

/** Call once at start-up: every menu screen asks for the playlist as it opens. */
export function bindMenuMusic(game: Phaser.Game): void {
  for (const key of MENU_SCENES) {
    game.scene.getScene(key)?.sys.events.on(Phaser.Scenes.Events.CREATE, playMenuMusic);
  }
}

/**
 * The music of one run (made by the HUD, fed every frame): its first frame asks for the playlist
 * or the daily tower's track; the pause window stops the music while it is up; while the run is
 * played the player decodes nothing (`busy`). `end` lets both go when the run's HUD goes away.
 */
export class RunMusic {
  private asked = false;
  private paused = false;
  private busy = false;

  /** `live`: the run is on screen (not over); `paused`: its pause window or countdown is up. */
  observe(live: boolean, daily: boolean, paused: boolean): void {
    if (live && !this.asked) {
      this.asked = true;
      cueMusic({ kind: 'run', daily });
    }
    this.pause(paused);
    this.setBusy(live && !paused);
  }

  end(): void {
    this.pause(false);
    this.setBusy(false);
  }

  private setBusy(on: boolean): void {
    if (on === this.busy) return;
    this.busy = on;
    services.audio.music.busy(on);
  }

  private pause(on: boolean): void {
    if (on === this.paused) return;
    this.paused = on;
    services.audio.music.hold('pause', on);
  }
}

/** Open windows hold the music duck; it lets go when the last one closes. */
export const windowDuck = new HoldCount((on) => services.audio.duckMusic('window', on));

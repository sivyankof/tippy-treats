import * as Phaser from 'phaser';
import { musicAskFor, type MusicCue } from '../../data/audio/music';
import { services } from '../../services';
import { HoldCount } from '../../util/hold-count';
import { SCENES } from '../app/scene-keys';
import { RunMusic } from './run-music';

/**
 * Where the game tells the music what to play (docs/06-art-animation-audio.md, section 7,
 * "Музыка"): the playlist everywhere, the daily tower's track for its whole run, the record track
 * while the results with a new record are up. The zones, a miss, "one more run" and the screens
 * in between ask nothing new (asking for what plays changes nothing). The run's pause window only
 * ducks the music, like any window. Calls before the first tap are remembered by the music proxy.
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
  services.audio.music.prepare(null);
}

/** The daily tower's screen: the playlist goes on, and the tower's own track is decoded ahead for its run. */
function playDailyScreenMusic(): void {
  cueMusic({ kind: 'menu' });
  services.audio.music.prepare('daily');
}

/** Every screen that is not the run or the results. */
const MENU_SCENES = [
  SCENES.home,
  SCENES.team,
  SCENES.collection,
  SCENES.creatureDetail,
  SCENES.shop,
  SCENES.newCreature,
  SCENES.lineup,
] as const;

/** Call once at start-up: every menu screen asks for the playlist as it opens. */
export function bindMenuMusic(game: Phaser.Game): void {
  for (const key of MENU_SCENES) {
    game.scene.getScene(key)?.sys.events.on(Phaser.Scenes.Events.CREATE, playMenuMusic);
  }
  game.scene
    .getScene(SCENES.daily)
    ?.sys.events.on(Phaser.Scenes.Events.CREATE, playDailyScreenMusic);
}

/** The music of one run, wired to the game's music player (the HUD makes one per run). */
export function createRunMusic(): RunMusic {
  return new RunMusic(cueMusic, (on) => services.audio.music.busy(on));
}

/** Open windows hold the music duck; it lets go when the last one closes. */
export const windowDuck = new HoldCount((on) => services.audio.duckMusic('window', on));

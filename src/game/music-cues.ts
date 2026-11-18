import * as Phaser from 'phaser';
import { musicTrackFor, type MusicCue } from '../data/music';
import { ZONES } from '../data/zones';
import { services } from '../services';
import { HoldCount } from '../util/hold-count';
import { SCENES } from './scene-keys';

/**
 * Where the game tells the music what to play (docs/06-art-animation-audio.md, section 7,
 * "Музыка"): the menus play the menu track, a run the track of its zone (the daily tower one
 * track for the whole run), the results with a new record their own; the results without a
 * record, the pause and "one more try?" keep the track of the zone. The player itself leaves a
 * track that already plays untouched, so screens can ask for it again freely. Calls before the
 * first tap are remembered by the music proxy.
 */

/** Asks the music for the track of `cue` (nothing when the cue keeps the music as it is). */
export function cueMusic(cue: MusicCue): void {
  const track = musicTrackFor(cue);
  if (track) services.audio.music.play(track);
}

/** A menu screen is up: the menu track. */
export function playMenuMusic(): void {
  cueMusic({ kind: 'menu' });
}

/** Every screen besides the run and the results: each asks for the menu track when it opens. */
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

/** Call once at start-up: every menu screen asks for the menu track as it opens. */
export function bindMenuMusic(game: Phaser.Game): void {
  for (const key of MENU_SCENES) {
    game.scene.getScene(key)?.sys.events.on(Phaser.Scenes.Events.CREATE, playMenuMusic);
  }
}

/** Follows the zone of one run: one per run (made by the HUD), fed every frame. */
export class RunMusic {
  private zoneIndex: number | null = null;

  /** `zoneIndex` of the live run, or null when there is none (the run is over or not there yet). */
  observe(zoneIndex: number | null, daily: boolean): void {
    if (zoneIndex === null || zoneIndex === this.zoneIndex) return;
    this.zoneIndex = zoneIndex;
    const zone = ZONES[Math.min(zoneIndex, ZONES.length - 1)];
    if (zone) cueMusic({ kind: 'run', zone: zone.id, daily });
  }
}

/** Open windows hold the music duck; it lets go when the last one closes. */
export const windowDuck = new HoldCount((on) => services.audio.duckMusic('window', on));

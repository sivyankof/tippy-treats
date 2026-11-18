import * as Phaser from 'phaser';
import { musicVariantOf } from '../data/music/songs';
import { services } from '../services';
import { zoneLayer } from '../services/audio/music/music-schedule';
import { HoldCount } from '../util/hold-count';
import { effectsMode } from './effects-mode';
import { SCENES } from './scene-keys';

/**
 * Where the game tells the music what to play (docs/06-art-animation-audio.md, section 7,
 * "Музыка"): the menus play layer 1 quietly, a run adds a layer per zone, open windows duck it.
 * The tune starts once and then only changes its layer and level, so it never restarts between
 * screens. Calls before the first tap are remembered by the music proxy.
 */

let started = false;

function startOnce(layer: number, menu: boolean): boolean {
  if (started) return false;
  started = true;
  const variant = musicVariantOf(new URLSearchParams(location.search).get('music'));
  services.audio.music.start({ variant, layer, menu });
  return true;
}

/** A menu screen is up: layer 1, at the menu level. */
export function playMenuMusic(): void {
  if (!startOnce(1, true)) services.audio.music.setMenu(true);
}

/** Every screen that is not the run (game and HUD): each turns the music to the menu arrangement when it opens. */
const MENU_SCENES = [
  SCENES.home,
  SCENES.team,
  SCENES.collection,
  SCENES.creatureDetail,
  SCENES.daily,
  SCENES.shop,
  SCENES.newCreature,
  SCENES.results,
  SCENES.lineup,
] as const;

/** Call once at start-up: every menu screen turns the music to the menu arrangement as it opens. */
export function bindMenuMusic(game: Phaser.Game): void {
  for (const key of MENU_SCENES) {
    game.scene.getScene(key)?.sys.events.on(Phaser.Scenes.Events.CREATE, playMenuMusic);
  }
}

/** Follows the zone of one run: one per run (made by the HUD), fed every frame. */
export class RunMusic {
  private layer: number | null = null;

  /** `zoneIndex` of the live run, or null when there is none (the run is over or not there yet). */
  observe(zoneIndex: number | null): void {
    if (zoneIndex === null) return;
    const layer = zoneLayer(zoneIndex, effectsMode.reduced);
    if (layer === this.layer) return;
    const first = this.layer === null;
    this.layer = layer;
    if (startOnce(layer, false)) return;
    const { music } = services.audio;
    music.setLayer(layer);
    if (first) music.setMenu(false);
  }
}

/** Open windows hold the music duck; it lets go when the last one closes. */
export const windowDuck = new HoldCount((on) => services.audio.duckMusic('window', on));

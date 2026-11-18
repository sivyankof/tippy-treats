import type { Mixer } from './mixer';
import type { NodeTally } from './node-tally';

/** The tunes of the game (docs/06, section 7): a, b and c are the three variants. */
export type MusicVariant = 'a' | 'b' | 'c';

export interface MusicStartOptions {
  variant: MusicVariant;
  /** Instrument layer 1..6: one more is added with every zone. */
  layer: number;
  /** Start in the quiet menu arrangement. */
  menu?: boolean;
}

/**
 * What the game asks of the music player (theme C implements it). Every call is safe at any
 * time: before the audio is unlocked it is remembered (`MusicProxy`), and a player must not throw.
 */
export interface MusicControl {
  /** Starts the tune (a running one is replaced). */
  start(options: MusicStartOptions): void;
  stop(): void;
  /** Sets the number of instrument layers heard, 1..6. */
  setLayer(layer: number): void;
  /** True: the quiet menu arrangement; false: the run arrangement. */
  setMenu(on: boolean): void;
}

/** What a music player gets to build on: the context, the music bus and the shared node tally. */
export interface MusicHost {
  ctx: BaseAudioContext;
  /** Connect every music voice here (never to the destination). */
  bus: GainNode;
  /** Count and release music nodes through `runSource` with this tally. */
  tally: NodeTally;
  /** Random numbers for the tune: `Math.random` live, a seeded one in an offline render. */
  random: () => number;
}

/** Builds the player over a host; the service calls it once, when the audio is unlocked. */
export type MusicFactory = (host: MusicHost) => MusicControl;

/** A player that does nothing: the default until theme C provides one. */
export const NO_MUSIC: MusicControl = {
  start: () => undefined,
  stop: () => undefined,
  setLayer: () => undefined,
  setMenu: () => undefined,
};

export const NO_MUSIC_FACTORY: MusicFactory = () => NO_MUSIC;

/** The host of a mixer (live or offline). */
export function musicHostOf(mixer: Mixer, random: () => number): MusicHost {
  return { ctx: mixer.ctx, bus: mixer.musicBus, tally: mixer.tally, random };
}

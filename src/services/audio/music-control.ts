import type { MusicTrackId } from '../../data/music';
import type { Mixer } from './mixer';
import type { NodeTally } from './node-tally';

/** What the music player reports for dev checks (the soundboard, the memory measurement). */
export interface MusicPlayerState {
  /** The track playing or coming in, null when stopped. */
  track: MusicTrackId | null;
  /** Decks alive now (a track playing, one leaving, one being cut). */
  decks: number;
  /** Decoded music in memory now (decks, and a decode under way counted at its full size), bytes. */
  decodedBytes: number;
  /** The most `decodedBytes` has been since the player was made or `resetPeak`. */
  peakBytes: number;
}

/**
 * What the game asks of the music player. Every call is safe at any time: before the audio is
 * unlocked it is remembered (`MusicProxy`), and a player must not throw.
 */
export interface MusicControl {
  /** Plays `track`, changing over from the one playing (the same track goes on untouched). */
  play(track: MusicTrackId): void;
  stop(): void;
  /** The audio is held (the app is in the background, an ad shows): streamed tracks pause too. */
  hold(on: boolean): void;
  state(): MusicPlayerState;
  resetPeak(): void;
}

/** What a music player gets to build on: the context, the music bus and the shared node tally. */
export interface MusicHost {
  ctx: BaseAudioContext;
  /** Connect every music voice here (never to the destination). */
  bus: GainNode;
  /** Count and release music nodes with this tally. */
  tally: NodeTally;
  /** The player calls this when a track starts or stops (the mixer softens the combo bell while one is heard). */
  onPlaying?: (playing: boolean) => void;
}

/** Builds the player over a host; the service calls it once, when the audio is unlocked (inside the gesture). */
export type MusicFactory = (host: MusicHost) => MusicControl;

const NO_STATE: MusicPlayerState = { track: null, decks: 0, decodedBytes: 0, peakBytes: 0 };

/** A player that does nothing (no music factory given). */
export const NO_MUSIC: MusicControl = {
  play: () => undefined,
  stop: () => undefined,
  hold: () => undefined,
  state: () => ({ ...NO_STATE }),
  resetPeak: () => undefined,
};

export const NO_MUSIC_FACTORY: MusicFactory = () => NO_MUSIC;

/** The host of a mixer (live or offline). */
export function musicHostOf(mixer: Mixer): MusicHost {
  return {
    ctx: mixer.ctx,
    bus: mixer.musicBus,
    tally: mixer.musicTally,
    onPlaying: (on) => mixer.setTunePlaying(on),
  };
}

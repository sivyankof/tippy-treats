import type { MusicTrackId } from '../../data/audio/music';
import type { Mixer } from './mixer';
import type { NodeTally } from './node-tally';

/**
 * Why the music stops where it is: the app is away (background, an ad). The run's pause only
 * ducks it, like any window.
 */
export type MusicHoldReason = 'app';

/** What the music player reports for dev checks (the soundboard, the memory measurement). */
export interface MusicPlayerState {
  /** The track playing or coming in, null when stopped. */
  track: MusicTrackId | null;
  /** The playlist plays (false: an exception track, or nothing). */
  playlist: boolean;
  /** Seconds the playlist's current track has played in its turn. */
  turnSec: number;
  /** Decks alive now (a track playing, one leaving, one being cut). */
  decks: number;
  /** Decoded music in memory now (decks, the prefetched track, decodes under way at full size), bytes. */
  decodedBytes: number;
  /** Decoded tracks in memory now (the buffers alive: decks, the parked and prefetched ones, decodes under way). */
  buffers: number;
  /** The most `decodedBytes` has been since the player was made or `resetPeak`. */
  peakBytes: number;
  /** A track was asked for and is still loading or starting. */
  loading: boolean;
}

/**
 * What the game asks of the music player. Every call is safe at any time: before the audio is
 * unlocked it is remembered (`MusicProxy`), and a player must not throw.
 */
export interface MusicControl {
  /** The playlist, going on where it stopped (nothing changes if it plays). */
  playlist(): void;
  /** One track round and round (the daily tower, the record), the playlist keeping its place. */
  play(track: MusicTrackId): void;
  /** The playlist's next track now (the soundboard). */
  next(): void;
  /**
   * Decodes `track` ahead while nothing else is changing (the daily tower's screen readies its
   * track, so its run starts without a decode); null lets such a track go.
   */
  prepare(track: MusicTrackId | null): void;
  stop(): void;
  /** Stops the music where it is while any reason holds; it goes on from there after. */
  hold(reason: MusicHoldReason, on: boolean): void;
  /**
   * A run is on (its pause window and countdown included): no file is decoded meanwhile (a
   * decode's end stalls the main thread), the playlist's track plays on by whole loops until the
   * run lets go.
   */
  busy(on: boolean): void;
  state(): MusicPlayerState;
  resetPeak(): void;
  /** A user tap: a track that did not start is asked again (then the playlist moves on). */
  gesture(): void;
  /** Stops at once and lets everything go; the player is not used after this. */
  dispose(): void;
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

const NO_STATE: MusicPlayerState = {
  track: null,
  playlist: false,
  turnSec: 0,
  decks: 0,
  decodedBytes: 0,
  buffers: 0,
  peakBytes: 0,
  loading: false,
};

/** A player that does nothing (no music factory given). */
export const NO_MUSIC: MusicControl = {
  playlist: () => undefined,
  play: () => undefined,
  next: () => undefined,
  prepare: () => undefined,
  stop: () => undefined,
  hold: () => undefined,
  busy: () => undefined,
  state: () => ({ ...NO_STATE }),
  resetPeak: () => undefined,
  gesture: () => undefined,
  dispose: () => undefined,
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

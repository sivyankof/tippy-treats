/**
 * The music of the game (docs/06-art-animation-audio.md, section 7, "Музыка"): ready-made tracks
 * from `assets/music/` (m4a, AAC; sources and licenses in `assets/LICENSES.md`). Times are
 * seconds, levels dB unless named otherwise.
 */

/** How a track goes round. */
export type TrackLoop =
  /**
   * The file is a seamless loop: decoded once and played by one looping buffer source. `frames`
   * and `sampleRate` are those of the source (the length of the loop to the sample).
   */
  | 'seamless'
  /**
   * The file is not a loop: streamed by media elements (never decoded whole, docs/08 journal:
   * the 110 MB cap). In the playlist it plays once; on its own it loops by fading its end into a
   * new pass from the start.
   */
  | 'overlap';

export interface MusicTrack {
  /** File name in `assets/music/`. */
  file: string;
  loop: TrackLoop;
  /** Length of the source in samples at `sampleRate` (for a seamless track, the loop length). */
  frames: number;
  sampleRate: number;
  /** Own level on top of the common one (all files are levelled to `MUSIC.fileLufs`). */
  gainDb: number;
}

export const MUSIC_TRACKS = {
  menu: {
    file: 'menu-cup-of-tea.m4a',
    loop: 'overlap',
    frames: 7_408_290,
    sampleRate: 44_100,
    gainDb: 0,
  },
  kitchen: {
    file: 'kitchen-what-would-you-give.m4a',
    loop: 'seamless',
    frames: 3_291_425,
    sampleRate: 48_000,
    gainDb: 0,
  },
  stars: {
    file: 'stars-lotus.m4a',
    loop: 'seamless',
    frames: 4_608_000,
    sampleRate: 48_000,
    gainDb: 0,
  },
  roof: {
    file: 'roof-tropical.m4a',
    loop: 'seamless',
    frames: 6_336_000,
    sampleRate: 48_000,
    gainDb: 0,
  },
  space: {
    file: 'space-ascension.m4a',
    loop: 'seamless',
    frames: 5_385_975,
    sampleRate: 48_000,
    gainDb: 0,
  },
  bartender: {
    file: 'bartender-short.m4a',
    loop: 'overlap',
    frames: 5_733_000,
    sampleRate: 44_100,
    gainDb: 0,
  },
  daily: {
    file: 'daily-loop-town.m4a',
    loop: 'seamless',
    frames: 5_224_512,
    sampleRate: 44_100,
    gainDb: 0,
  },
  record: {
    file: 'record-happy-theme.m4a',
    loop: 'seamless',
    frames: 2_116_864,
    sampleRate: 44_100,
    gainDb: 0,
  },
} as const satisfies Record<string, MusicTrack>;

export type MusicTrackId = keyof typeof MUSIC_TRACKS;

export const MUSIC_TRACK_IDS = Object.keys(MUSIC_TRACKS) as MusicTrackId[];

/**
 * The playlist (docs/06, section 7): played everywhere, round and round in this order, the first
 * one picked at random when the game starts. The file names are the old zone names; they no
 * longer mean a zone.
 */
export const MUSIC_PLAYLIST: readonly MusicTrackId[] = [
  'menu',
  'kitchen',
  'roof',
  'stars',
  'space',
  'bartender',
];

/** What the music is asked to play: the playlist, or one track round and round (an exception). */
export type MusicAsk = { kind: 'playlist' } | { kind: 'track'; track: MusicTrackId };

/** Where the player is, as far as the music cares (the zones are not here: they do not touch it). */
export type MusicCue =
  { kind: 'menu' } | { kind: 'run'; daily: boolean } | { kind: 'results'; record: boolean };

/**
 * What `cue` asks of the music, or null when the music goes on as it is: every menu screen and a
 * classic run ask for the playlist (which goes on untouched if it plays), the daily tower for its
 * own track for the whole run, the results with a new record for the record track; the results
 * without a record ask nothing.
 */
export function musicAskFor(cue: MusicCue): MusicAsk | null {
  switch (cue.kind) {
    case 'menu':
      return { kind: 'playlist' };
    case 'run':
      return cue.daily ? { kind: 'track', track: 'daily' } : { kind: 'playlist' };
    case 'results':
      return cue.record ? { kind: 'track', track: 'record' } : null;
  }
}

export const MUSIC = {
  /** Loudness of the files (they were levelled before they came into the project). */
  fileLufs: -16,
  /** Loudness of the music at the output of the music bus (what goes into the master). */
  busLufs: -20,
  /** A change of track: the old one fades out, the new one in, over this long. */
  crossfadeSec: 2.5,
  /** The music coming in from silence (the first tap, the music switch) rises this fast. */
  entrySec: 0.3,
  /** Every track of the playlist plays at least this long: a seamless loop whole rounds up to it. */
  minPlaySec: 150,
  /** The next seamless track of the playlist is decoded this long before its change. */
  prefetchSec: 8,
  /** The change of a playlist track is put on the context's clock this long before it is due. */
  switchLeadSec: 0.5,
  /** A playlist turn is looked at this often while it plays (the change itself is exact). */
  watchSec: 1,
  /** A streamed track played on its own (the soundboard) starts its next pass this long before the end and fades over it. */
  loopOverlapSec: 2,
  /** A third track asked for during a change cuts the oldest one this fast. */
  cutSec: 0.1,
  /** A hold (the run's pause, the app in the background) fades the music out and back in this fast. */
  holdFadeSec: 0.03,
  /** The music switch and `stop`: the music fades out this fast. */
  stopSec: 0.25,
  /** Steps of the equal-power curve of a fade (straight ramps between them). */
  fadeSteps: 12,
  /** Encoder delay of AAC: a decoder that keeps it gives a file this much longer at the start. */
  aacPrimingFrames: 2112,
  /** The seam of a seamless loop is smoothed over this long at the end of the decoded loop. */
  seamSmoothSec: 0.01,
  /** The seam aims at a line fitted to the last `fit` samples and averages the tail over `radius` each side. */
  seam: { fit: 16, radius: 2 },
  /** Media elements of the streamed tracks (up to two per deck: playing, leaving, parked, being cut). */
  streamElements: 8,
  /** Decoded tracks in memory at a time (playing and incoming, or playing and parked or prefetched). */
  maxDecoded: 2,
  /** How often a waiting timer looks again (the context may be held, the stream may lag). */
  pollSec: 0.25,
  /** The shortest sleep of a loop timer (no busy waking right at the turn). */
  minWaitSec: 0.05,
  /** Decoded music in memory must stay under this at any moment, a change included (bytes). */
  memoryCapBytes: 110_000_000,
} as const;

import type { ZoneId } from './zones';

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
   * the 110 MB cap) and looped by fading its end into a new pass from the start.
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
  showcase: {
    file: 'showcase-bartender.m4a',
    loop: 'overlap',
    frames: 10_820_449,
    sampleRate: 44_100,
    gainDb: -1,
  },
  roof: {
    file: 'roof-tropical.m4a',
    loop: 'seamless',
    frames: 6_336_000,
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
  space: {
    file: 'space-ascension.m4a',
    loop: 'seamless',
    frames: 5_385_975,
    sampleRate: 48_000,
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

/** Places of the game that have their own music: the menus, every zone, the daily tower, a record. */
export type MusicPlace = 'menu' | ZoneId | 'daily' | 'record';

/** The track of every place (the table of docs/06, section 7). */
export const MUSIC_PLACES: Readonly<Record<MusicPlace, MusicTrackId>> = {
  menu: 'menu',
  kitchen: 'kitchen',
  showcase: 'showcase',
  roof: 'roof',
  clouds: 'roof',
  stars: 'stars',
  space: 'space',
  daily: 'daily',
  record: 'record',
};

/** Where the player is, as far as the music cares. */
export type MusicCue =
  | { kind: 'menu' }
  | { kind: 'run'; zone: ZoneId; daily: boolean }
  | { kind: 'results'; record: boolean };

/**
 * The track `cue` asks for, or null when the music goes on as it is: the results without a record
 * keep the track of the zone (as the pause and "one more try?" do, which send no cue at all).
 */
export function musicTrackFor(cue: MusicCue): MusicTrackId | null {
  switch (cue.kind) {
    case 'menu':
      return MUSIC_PLACES.menu;
    case 'run':
      return MUSIC_PLACES[cue.daily ? 'daily' : cue.zone];
    case 'results':
      return cue.record ? MUSIC_PLACES.record : null;
  }
}

export const MUSIC = {
  /** Loudness of the files (they were levelled before they came into the project). */
  fileLufs: -16,
  /** Loudness of the music at the output of the music bus (what goes into the master). */
  busLufs: -20,
  /** A change of track: the old one fades out, the new one in, over this long. */
  crossfadeSec: 2.5,
  /** A streamed (non-seamless) track starts its next pass this long before the end and fades over it. */
  loopOverlapSec: 2,
  /** A third track asked for during a change cuts the oldest one this fast. */
  cutSec: 0.1,
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
  /** Media elements of the streamed tracks (two per track, three tracks: playing, leaving, cut). */
  streamElements: 6,
  /** How often a waiting timer looks again (the context may be held, the stream may lag). */
  pollSec: 0.25,
  /** The shortest sleep of a loop timer (no busy waking right at the turn). */
  minWaitSec: 0.05,
  /** Decoded music in memory must stay under this at any moment, a change included (bytes). */
  memoryCapBytes: 110_000_000,
} as const;

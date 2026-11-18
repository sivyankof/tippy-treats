import type { Chord } from './harmony';
import type { InstrumentId } from './instruments';

/**
 * The format of a tune of the game (docs/06-art-animation-audio.md, section 7, "Музыка").
 * A tune is pure data: a chord per bar and bars of notes per part; one scheduler
 * (`services/audio/music/music-schedule.ts`) and one instrument set (`instruments.ts`) play
 * every tune.
 */

/**
 * One note: start step inside its bar, pitch in semitones from C4 (0 = C4, 12 = C5, -12 = C3),
 * length in steps (may run past the bar line), velocity 0..1 (default 1). Unpitched parts
 * (drums) ignore the pitch and write 0.
 */
export type NoteData = readonly [step: number, pitch: number, length: number, velocity?: number];

/** The notes of one bar of one part. */
export type Bar = readonly NoteData[];

/** One slot of a part's form: a phrase id, or alternatives one of which a loop picks (seeded). */
export type FormSlot = string | readonly string[];

/**
 * What a part is in the mix: the soundboard knobs act on roles (`drums`, `melody`); the keys
 * and the melody go through the soft electric-piano filter of the music chain.
 */
export type PartRole = 'keys' | 'bass' | 'drums' | 'melody';

/**
 * How the pitches of a part relate to the chord of their bar (checked by the tests): `chord`
 * only chord tones, `tension` chord tones and the soft tensions of `fitsChord`, `none` unpitched.
 */
export type PartHarmony = 'chord' | 'tension' | 'none';

export interface SongPart {
  /** Name of the part (debug, docs). */
  id: string;
  /** Recipe of `instruments.ts` that plays the part. */
  instrument: InstrumentId;
  role: PartRole;
  harmony: PartHarmony;
  /** The zone layer from which the part plays (1..6); layer n plays every part with `layer <= n`. */
  layer: number;
  /** Loudness of the part (linear, multiplied by the note velocity). */
  gain: number;
  /** Named runs of bars. */
  phrases: Readonly<Record<string, readonly Bar[]>>;
  /** The phrases in loop order; their bars add up to the song's `bars`. */
  form: readonly FormSlot[];
  /** Bars (0-based, in the loop) the part may leave out for a loop: a short breath (variation). */
  restBars?: readonly number[];
  /** Plays in place of the last bar of the loop when the loop gets a fill (variation). */
  fill?: Bar;
  /** A lazy hit: with this chance a note sounds `sec` behind the grid (the snare). */
  late?: { chance: number; sec: number };
}

export interface Song {
  /** Name of the tune (debug, file names). */
  name: string;
  bpm: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  /** Bars in one loop. */
  bars: number;
  /**
   * Swing: where the second eighth of each beat lands, as a share of the beat (0.5 straight,
   * 0.55-0.6 the lazy lofi feel). The sixteenths in between follow proportionally.
   */
  swing: number;
  /** Seeded looseness of every note: time +-`timeSec`, velocity +-`velocity` (share). */
  humanize: { timeSec: number; velocity: number };
  /** The chord of each bar of the loop (`bars` entries). */
  chords: readonly Chord[];
  /** Loudness of the whole tune, so the three variants sit at the same level. */
  gain: number;
  /** Parts in layer order. */
  parts: readonly SongPart[];
  /** Chance per loop (from the second loop on) that one rest bar of each part is left out. */
  restChance: number;
  /** Chance per loop (from the second loop on) that the loop ends with its fill. */
  fillChance: number;
}

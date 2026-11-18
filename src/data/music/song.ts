import type { InstrumentId } from './instruments';

/**
 * The format of a tune of the game (docs/06-art-animation-audio.md, section 7, "Музыка").
 * A tune is pure data: bars of notes per part; one scheduler (`services/audio/music/music-schedule.ts`)
 * and one instrument set (`instruments.ts`) play every tune.
 */

/**
 * One note: start step inside its bar, pitch in semitones from C4 (0 = C4, 12 = C5, -12 = C3),
 * length in steps (may run past the bar line), velocity 0..1 (default 1). Unpitched parts
 * (drums, noise) ignore the pitch and write 0.
 */
export type NoteData = readonly [step: number, pitch: number, length: number, velocity?: number];

/** The notes of one bar of one part. */
export type Bar = readonly NoteData[];

/** Pitch-class sets a part may use (semitones above C, 0..11). */
export const SCALES = {
  /** C major pentatonic C D E G A: the same notes as the combo bell ladder, so nothing clashes. */
  penta: [0, 2, 4, 7, 9],
  /** The pentatonic and F: only for bass roots of the F chord, low and far under the bells. */
  pentaF: [0, 2, 4, 5, 7, 9],
  /** Drums and noise: no pitch. */
  unpitched: [],
} as const satisfies Record<string, readonly number[]>;

export type ScaleId = keyof typeof SCALES;

/** One slot of a part's form: a phrase id, or alternatives one of which a loop picks (seeded). */
export type FormSlot = string | readonly string[];

export interface SongPart {
  /** Name of the part (debug, docs). */
  id: string;
  /** Recipe of `instruments.ts` that plays the part. */
  instrument: InstrumentId;
  /** The zone layer from which the part plays (1..6); layer n plays every part with `layer <= n`. */
  layer: number;
  /** Loudness of the part (linear, multiplied by the note velocity). */
  gain: number;
  scale: ScaleId;
  /** Named runs of bars. */
  phrases: Readonly<Record<string, readonly Bar[]>>;
  /** The phrases in loop order; their bars add up to the song's `bars`. */
  form: readonly FormSlot[];
  /** Bars (0-based, in the loop) the part may leave out for a loop: a short breath (variation). */
  restBars?: readonly number[];
  /** Plays in place of the last bar of the loop when the loop gets a fill (variation). */
  fill?: Bar;
}

export interface Song {
  /** Name of the tune (debug, file names). */
  name: string;
  bpm: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  /** Bars in one loop. */
  bars: number;
  /** Loudness of the whole tune, so the three variants sit at the same level. */
  gain: number;
  /** Parts in layer order: the part of layer 1 first. */
  parts: readonly SongPart[];
  /** Chance per loop (from the second loop on) that one rest bar of each part is left out. */
  restChance: number;
  /** Chance per loop (from the second loop on) that the loop ends with its fill. */
  fillChance: number;
}

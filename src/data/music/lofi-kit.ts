import { leadProgression, type Chord } from './harmony';
import type { InstrumentId } from './instruments';
import { bassBar, compBar, hits, slotsOf, type BassHit, type CompHit } from './note-tools';
import type { Bar, FormSlot, Song, SongPart } from './song';

/**
 * The common build of the three lofi tunes (docs/06, section 7, "Музыка"): every tune has the
 * same six layers and differs in key, chords, tempo, rhythms and melody.
 *
 *   1 keys    electric piano chords (rootless voicings, led by `leadProgression`, a left-hand root)
 *   2 bass    long root and fifth notes
 *   3 kick and hat
 *   4 snare   on 2 and 4, sometimes lazy
 *   5 melody  sparse phrases with long rests
 *   6 second  a second chord line or a counter-line
 *
 * The tape hiss and crackle play with layer 1 (they belong to the music chain, not to a part).
 */

/** Unpitched hits of one drum bar: `[step, velocity]`. */
export type DrumPattern = readonly (readonly [number, number])[];

/** A part written out by hand (melody, counter-line): its phrases, form and rests. */
export interface WrittenPart {
  instrument: InstrumentId;
  gain: number;
  phrases: Readonly<Record<string, readonly Bar[]>>;
  form: readonly FormSlot[];
  restBars?: readonly number[];
  fill?: Bar;
}

export interface LofiSpec {
  name: string;
  bpm: number;
  swing: number;
  humanize: { timeSec: number; velocity: number };
  gain: number;
  /** The chord of each bar; its length is the loop length in bars. */
  chords: readonly Chord[];
  /** Range and middle of the keys' voicings (semitones from C4). */
  voicing: { low: number; high: number; center: number };
  keys: { gain: number; rootLow: number; patterns: readonly (readonly CompHit[])[] };
  bass: { gain: number; low: number; patterns: readonly (readonly BassHit[])[] };
  kick: { gain: number; patterns: readonly DrumPattern[]; fill: DrumPattern };
  hat: { gain: number; patterns: readonly DrumPattern[]; fill: DrumPattern };
  snare: {
    gain: number;
    patterns: readonly DrumPattern[];
    fill: DrumPattern;
    late: { chance: number; sec: number };
  };
  melody: WrittenPart;
  /** Layer 6: the second chord line or counter-line, its role and harmony rule. */
  second: WrittenPart & { role: 'keys' | 'melody'; harmony: 'chord' | 'tension' };
  restChance: number;
  fillChance: number;
}

/** Bars of the keys, bass and drums vary their pattern every this many bars. */
const SLOT_BARS = 4;

function drumPart(
  id: string,
  instrument: InstrumentId,
  layer: number,
  bars: number,
  spec: { gain: number; patterns: readonly DrumPattern[]; fill: DrumPattern },
  late?: { chance: number; sec: number },
): SongPart {
  const { phrases, form } = slotsOf(bars, SLOT_BARS, spec.patterns, (_, p) => hits(p));
  return {
    id,
    instrument,
    role: 'drums',
    harmony: 'none',
    layer,
    gain: spec.gain,
    phrases,
    form,
    fill: hits(spec.fill),
    ...(late ? { late } : {}),
  };
}

/** Builds a tune from its spec. */
export function lofiSong(spec: LofiSpec): Song {
  const bars = spec.chords.length;
  const chordAt = (i: number): Chord => spec.chords[i] as Chord;
  const { low, high, center } = spec.voicing;
  const voicings = leadProgression(spec.chords, low, high, center);
  const keys = slotsOf(bars, SLOT_BARS, spec.keys.patterns, (i, pattern) =>
    compBar(chordAt(i), voicings[i] ?? [], spec.keys.rootLow, pattern),
  );
  const bass = slotsOf(bars, SLOT_BARS, spec.bass.patterns, (i, pattern) =>
    bassBar(chordAt(i), spec.bass.low, pattern),
  );
  const written = (
    id: string,
    layer: number,
    part: WrittenPart,
    role: SongPart['role'],
    harmony: SongPart['harmony'],
  ): SongPart => ({ id, layer, role, harmony, ...part });
  return {
    name: spec.name,
    bpm: spec.bpm,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    bars,
    swing: spec.swing,
    humanize: spec.humanize,
    chords: spec.chords,
    gain: spec.gain,
    restChance: spec.restChance,
    fillChance: spec.fillChance,
    parts: [
      {
        id: 'keys',
        instrument: 'ep',
        role: 'keys',
        harmony: 'chord',
        layer: 1,
        gain: spec.keys.gain,
        ...keys,
      },
      {
        id: 'bass',
        instrument: 'bass',
        role: 'bass',
        harmony: 'chord',
        layer: 2,
        gain: spec.bass.gain,
        restBars: [3, 11],
        ...bass,
      },
      drumPart('kick', 'kick', 3, bars, spec.kick),
      drumPart('hat', 'hat', 3, bars, spec.hat),
      drumPart('snare', 'snare', 4, bars, spec.snare, spec.snare.late),
      written('melody', 5, spec.melody, 'melody', 'tension'),
      written('second', 6, spec.second, spec.second.role, spec.second.harmony),
    ],
  };
}

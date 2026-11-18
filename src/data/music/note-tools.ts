import { bassPitch, pitchClass, type Chord } from './harmony';
import type { Bar, FormSlot, NoteData } from './song';

/**
 * Small builders the tune files write their bars with (pure data at load time): chord comping,
 * bass lines and drum bars are spelled once and laid out by these.
 */

/** The notes of several bars played together in one bar, in time order. */
export function together(...bars: readonly Bar[]): Bar {
  return bars.flat().sort((a, b) => a[0] - b[0]);
}

/** `count` copies of one bar. */
export function repeat(count: number, bar: Bar): Bar[] {
  return Array.from({ length: count }, () => bar);
}

/** Every pitch of `pitches` at `step`, `length` steps long. */
export function chordNotes(
  pitches: readonly number[],
  step: number,
  length: number,
  velocity = 1,
): NoteData[] {
  return pitches.map((pitch) => [step, pitch, length, velocity] as const);
}

/** One unpitched hit per entry: `[step, velocity]`. */
export function hits(pattern: readonly (readonly [number, number])[], length = 1): NoteData[] {
  return pattern.map(([step, velocity]) => [step, 0, length, velocity] as const);
}

/** One hit of the keys: step, length, velocity; `low` adds the left-hand root under the voicing. */
export type CompHit = readonly [step: number, length: number, velocity: number, low?: boolean];

/** One bar of the keys: the voicing at every hit, the root (from `rootLow` up) at the `low` ones. */
export function compBar(
  c: Chord,
  voicing: readonly number[],
  rootLow: number,
  pattern: readonly CompHit[],
): Bar {
  const root = bassPitch(c, rootLow);
  return together(
    ...pattern.map(([step, length, velocity, low]) => [
      ...(low ? [[step, root, length, velocity] as const] : []),
      ...chordNotes(voicing, step, length, velocity),
    ]),
  );
}

/** One note of a bass bar: step, the chord's root or fifth (or the root an octave up), length, velocity. */
export type BassHit = readonly [
  step: number,
  degree: 'root' | 'fifth' | 'octave',
  length: number,
  velocity: number,
];

/**
 * One bar of the bass over chord `c`: the bass note from `low` up, its octave, or the fifth of
 * the chord's root above it (over a slash chord the fifth of the chord, not of the bass note).
 */
export function bassBar(c: Chord, low: number, pattern: readonly BassHit[]): Bar {
  const bass = bassPitch(c, low);
  const above = { root: 0, fifth: pitchClass(c.root + 7 - c.bass), octave: 12 } as const;
  return pattern.map(([step, degree, length, velocity]) => [
    step,
    bass + above[degree],
    length,
    velocity,
  ]);
}

/**
 * Phrases and form of a part that follows the chords: the loop is cut into slots of `slotBars`,
 * each slot may be played in any of the `patterns` (a seeded pick per loop, the first one on the
 * first loop). `bar(chordIndex, pattern)` builds one bar.
 */
export function slotsOf<P>(
  bars: number,
  slotBars: number,
  patterns: readonly P[],
  bar: (index: number, pattern: P) => Bar,
): { phrases: Record<string, Bar[]>; form: FormSlot[] } {
  const phrases: Record<string, Bar[]> = {};
  const form: FormSlot[] = [];
  for (let first = 0; first < bars; first += slotBars) {
    const ids = patterns.map((pattern, p) => {
      const id = `${first}-${p}`;
      phrases[id] = Array.from({ length: Math.min(slotBars, bars - first) }, (_, i) =>
        bar(first + i, pattern),
      );
      return id;
    });
    form.push(ids.length === 1 ? (ids[0] ?? '') : ids);
  }
  return { phrases, form };
}

/** `count` empty bars (a rest phrase). */
export function silence(count: number): Bar[] {
  return repeat(count, []);
}

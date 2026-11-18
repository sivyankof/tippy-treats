import type { Bar, NoteData } from './song';

/**
 * Small builders the tune files write their bars with (pure data at load time): repeating
 * figures, chords and arpeggios are spelled once and laid out by these.
 */

/** The notes of several bars played together in one bar (a melody and its low notes). */
export function together(...bars: readonly Bar[]): Bar {
  return bars.flat().sort((a, b) => a[0] - b[0]);
}

/** `count` copies of one bar. */
export function repeat(count: number, bar: Bar): Bar[] {
  return Array.from({ length: count }, () => bar);
}

/** Every pitch of `pitches` at `step`, `length` steps long. */
export function chord(
  pitches: readonly number[],
  step: number,
  length: number,
  velocity = 1,
): NoteData[] {
  return pitches.map((pitch) => [step, pitch, length, velocity] as const);
}

/**
 * An arpeggio over `tones`: from `start`, one note every `every` steps, `count` notes, the tone
 * index of note i is `order[i % order.length]`, its velocity `velocities[i % velocities.length]`.
 */
export function arpeggio(
  tones: readonly number[],
  options: {
    start?: number;
    every: number;
    count: number;
    length: number;
    order: readonly number[];
    velocities: readonly number[];
  },
): NoteData[] {
  const { start = 0, every, count, length, order, velocities } = options;
  return Array.from({ length: count }, (_, i) => {
    const tone = tones[order[i % order.length] ?? 0] ?? 0;
    const velocity = velocities[i % velocities.length] ?? 1;
    return [start + i * every, tone, length, velocity] as const;
  });
}

/** One unpitched hit per entry: `[step, velocity]`. */
export function hits(pattern: readonly (readonly [number, number])[], length = 1): NoteData[] {
  return pattern.map(([step, velocity]) => [step, 0, length, velocity] as const);
}

import { describe, expect, it } from 'vitest';
import type { TimedTone } from './sfx';
import { LIFE_NOTES, SFX_LIFE } from './sfx-life';

/** Pitch classes of C D E G A, counted from C. */
const PENTATONIC = new Set([0, 2, 4, 7, 9]);
const C5 = 523.25;

function pitchClass(freq: number): number {
  const semitones = 12 * Math.log2(freq / C5);
  return ((Math.round(semitones) % 12) + 12) % 12;
}

describe('SFX_LIFE', () => {
  it('keeps the tonal sounds on the C major pentatonic', () => {
    for (const freq of LIFE_NOTES) expect(PENTATONIC.has(pitchClass(freq)), `${freq}`).toBe(true);
    const tonal: readonly TimedTone[] = [
      ...SFX_LIFE.zone.notes,
      ...SFX_LIFE.lap.notes,
      { ...SFX_LIFE.tick.calm, delay: 0 },
      { ...SFX_LIFE.tick.urgent, delay: 0 },
    ];
    for (const note of tonal) {
      expect(PENTATONIC.has(pitchClass(note.freq)), `${note.freq}`).toBe(true);
    }
  });

  it('makes the last two seconds of the countdown higher than the rest', () => {
    expect(SFX_LIFE.tick.urgent.freq).toBeGreaterThan(SFX_LIFE.tick.calm.freq);
  });

  it('has the thunder delay and roll of the brief', () => {
    expect(SFX_LIFE.thunder.delay).toEqual([0.15, 0.4]);
    expect(SFX_LIFE.thunder.rollSeconds).toEqual([0.8, 1.2]);
  });

  it('has a squash sound for every topper and for the cream', () => {
    expect(Object.keys(SFX_LIFE.squash).sort()).toEqual(
      ['cherry', 'cream', 'lemon', 'mint', 'strawberry', 'wafer'].sort(),
    );
  });
});

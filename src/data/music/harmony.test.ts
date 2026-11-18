import { describe, expect, it } from 'vitest';
import {
  bassPitch,
  chord,
  fitsChord,
  largestMove,
  leadProgression,
  pitchClass,
  voiceMotion,
} from './harmony';

const C = 0;
const D = 2;
const E = 4;
const G = 7;
const A = 9;

describe('chord', () => {
  it('spells the tones, the seventh, the rootless voicing and a slash bass', () => {
    const dm9 = chord('D', 'm9', 'C');
    expect(dm9.name).toBe('Dm9/C');
    expect(dm9.root).toBe(2);
    expect(dm9.bass).toBe(0);
    expect(dm9.tones).toEqual([2, 5, 9, 0, 4]);
    expect(dm9.seventh).toBe(0);
    expect(dm9.voice).toEqual([5, 9, 0, 4]);
    expect(chord('C', 'maj9').seventh).toBe(11);
    expect(chord('C', '6/9').seventh).toBeNull();
  });

  it('pitchClass wraps negative pitches', () => {
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(-12)).toBe(0);
    expect(pitchClass(26)).toBe(2);
  });

  it('bassPitch puts the bass note in the octave from `low`', () => {
    expect(bassPitch(chord('C', 'maj9'), -24)).toBe(-24);
    expect(bassPitch(chord('G', '9sus4'), -24)).toBe(-17);
    expect(bassPitch(chord('D', 'm9', 'C'), -20)).toBe(-12);
  });
});

describe('fitsChord (the combo bell rule)', () => {
  it('a chord tone always fits', () => {
    for (const pc of chord('A', 'm9').tones) expect(fitsChord(chord('A', 'm9'), pc)).toBe(true);
  });

  it('a note a semitone above a chord tone does not fit (minor ninth)', () => {
    // C over Em7: a semitone above B.
    expect(fitsChord(chord('E', 'm7'), C)).toBe(false);
    // C over G6/9: a semitone above B, the classic avoid note.
    expect(fitsChord(chord('G', '6/9'), C)).toBe(false);
  });

  it('a note a semitone under a chord tone fits only under the seventh', () => {
    // E over G9sus4 is a 13th under the b7 F: soft.
    expect(fitsChord(chord('G', '9sus4'), E)).toBe(true);
    // E over C9sus4 is the third under the sus4 F: it rubs.
    expect(fitsChord(chord('C', '9sus4'), E)).toBe(false);
  });

  it('ninths, sixths and elevenths of minor chords fit', () => {
    expect(fitsChord(chord('C', 'maj7'), D)).toBe(true);
    expect(fitsChord(chord('C', 'maj7'), A)).toBe(true);
    expect(fitsChord(chord('A', 'm7'), D)).toBe(true);
    expect(fitsChord(chord('D', 'm9'), G)).toBe(true);
  });
});

describe('voice leading', () => {
  it('measures motion between sorted voicings', () => {
    expect(voiceMotion([0, 4, 7], [0, 5, 9])).toBe(3);
    expect(largestMove([0, 4, 7], [0, 5, 9])).toBe(2);
  });

  it('leads a looping progression by small steps inside the range, back to the start too', () => {
    const chords = [chord('C', 'maj9'), chord('A', 'm9'), chord('D', 'm9'), chord('G', '9sus4')];
    const voicings = leadProgression(chords, -8, 14, 4);
    expect(voicings).toHaveLength(4);
    voicings.forEach((voicing, i) => {
      const c = chords[i];
      expect(voicing).toHaveLength(4);
      for (const p of voicing) {
        expect(p).toBeGreaterThanOrEqual(-8);
        expect(p).toBeLessThanOrEqual(14);
        expect(c?.voice).toContain(pitchClass(p));
      }
      const next = voicings[(i + 1) % voicings.length] ?? [];
      expect(largestMove(voicing, next)).toBeLessThanOrEqual(2);
    });
  });

  it('is deterministic', () => {
    const chords = [chord('F', 'maj9'), chord('D', 'm11'), chord('G', 'm9'), chord('C', '13')];
    expect(leadProgression(chords, -9, 14, 3)).toEqual(leadProgression(chords, -9, 14, 3));
  });
});

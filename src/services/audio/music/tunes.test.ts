import { describe, expect, it } from 'vitest';
import { SFX } from '../../../data/sfx';
import { fitsChord, largestMove, pitchClass } from '../../../data/music/harmony';
import { MUSIC_PLAY } from '../../../data/music/music-play';
import type { Song } from '../../../data/music/song';
import {
  DEFAULT_MUSIC_VARIANT,
  MUSIC_FILES,
  MUSIC_VARIANTS,
  SONGS,
  musicVariantOf,
} from '../../../data/music/songs';
import { barNotes, planLoop, songTiming, type LoopPlan } from './music-schedule';

const ALL = MUSIC_VARIANTS.map((variant) => [variant, SONGS[variant]] as const);

/** Every plan a loop can take: each alternative of each slot, with and without the fill. */
function plans(song: Song): LoopPlan[] {
  const base = planLoop(song, 1, 0);
  const result: LoopPlan[] = [base, { ...base, fill: true }];
  song.parts.forEach((part, p) =>
    part.form.forEach((slot, s) => {
      if (typeof slot === 'string') return;
      slot.forEach((_, alt) => {
        const picks = base.picks.map((row) => [...row]);
        const row = picks[p];
        if (row) row[s] = alt;
        result.push({ ...base, picks });
      });
    }),
  );
  return result;
}

/** Every note of every plan with its bar: `[part index, bar, pitch]`. */
function everyNote(song: Song): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const plan of plans(song)) {
    song.parts.forEach((_, index) => {
      for (let bar = 0; bar < song.bars; bar++) {
        for (const [, pitch] of barNotes(song, index, plan, bar)) out.push([index, bar, pitch]);
      }
    });
  }
  return out;
}

/** The combo bell ladder as pitch classes (C major pentatonic from C5). */
const LADDER = [...new Set(SFX.perfect.ladderSemitones.map((s) => pitchClass(s)))];

describe('musicVariantOf', () => {
  it('takes a known variant and falls back to the default otherwise', () => {
    for (const variant of MUSIC_VARIANTS) expect(musicVariantOf(variant)).toBe(variant);
    expect(musicVariantOf('x')).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf('')).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf(null)).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf('A')).toBe(DEFAULT_MUSIC_VARIANT);
  });

  it('no file fallback is set: every tune is synthesized', () => {
    expect(Object.keys(MUSIC_FILES)).toEqual([]);
  });
});

describe('lofi tunes', () => {
  it.each(ALL)('%s: 70-78 bpm, light swing, humanize 10-15 ms and 10%%', (_, song) => {
    expect(song.bpm).toBeGreaterThanOrEqual(70);
    expect(song.bpm).toBeLessThanOrEqual(78);
    expect(song.swing).toBeGreaterThanOrEqual(0.55);
    expect(song.swing).toBeLessThanOrEqual(0.6);
    expect(song.humanize.timeSec).toBeGreaterThanOrEqual(0.01);
    expect(song.humanize.timeSec).toBeLessThanOrEqual(0.015);
    expect(song.humanize.velocity).toBeLessThanOrEqual(0.1);
  });

  it('«Вечер» is the slowest, at 70', () => {
    expect(SONGS.c.bpm).toBe(70);
    expect(Math.min(...ALL.map(([, song]) => song.bpm))).toBe(70);
  });

  it.each(ALL)('%s: 16-32 bars, a chord per bar, six layers', (_, song) => {
    expect(song.bars).toBeGreaterThanOrEqual(16);
    expect(song.bars).toBeLessThanOrEqual(32);
    expect(song.chords).toHaveLength(song.bars);
    expect([...new Set(song.parts.map((part) => part.layer))]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it.each(ALL)('%s: every form fills the loop exactly, every alternative too', (_, song) => {
    song.parts.forEach((part, index) => {
      for (const plan of plans(song)) {
        let bars = 0;
        part.form.forEach((slot, s) => {
          const id = typeof slot === 'string' ? slot : slot[plan.picks[index]?.[s] ?? 0];
          const phrase = id === undefined ? undefined : part.phrases[id];
          expect(phrase, `${part.id} slot ${s}`).toBeDefined();
          bars += phrase?.length ?? 0;
        });
        expect(bars, part.id).toBe(song.bars);
      }
    });
  });

  it.each(ALL)('%s: notes start inside their bar, lengths and velocities sane', (_, song) => {
    const { stepsPerBar } = songTiming(song);
    for (const plan of plans(song)) {
      song.parts.forEach((_part, index) => {
        for (let bar = 0; bar < song.bars; bar++) {
          for (const [step, , length, velocity = 1] of barNotes(song, index, plan, bar)) {
            expect(step).toBeGreaterThanOrEqual(0);
            expect(step).toBeLessThan(stepsPerBar);
            expect(length).toBeGreaterThan(0);
            expect(velocity).toBeGreaterThan(0);
            expect(velocity).toBeLessThanOrEqual(1);
          }
        }
      });
    }
  });

  it.each(ALL)('%s: chord parts play chord tones, the melody only soft tensions', (_, song) => {
    for (const [index, bar, pitch] of everyNote(song)) {
      const part = song.parts[index];
      const c = song.chords[bar];
      if (!part || !c) continue;
      const label = `${part.id} bar ${bar} pitch ${pitch} over ${c.name}`;
      if (part.harmony === 'none') expect(pitch, label).toBe(0);
      else if (part.harmony === 'chord') expect(c.tones, label).toContain(pitchClass(pitch));
      else expect(fitsChord(c, pitch), label).toBe(true);
    }
  });

  it.each(ALL)('%s: every combo bell fits every chord (consonance rule)', (_, song) => {
    for (const c of song.chords) {
      for (const pc of LADDER) expect(fitsChord(c, pc), `${pc} over ${c.name}`).toBe(true);
    }
  });

  it.each(ALL)('%s: the keys move by step: no voice moves more than 3 semitones', (_, song) => {
    const keys = song.parts.findIndex((part) => part.id === 'keys');
    const plan = planLoop(song, 1, 0);
    // The four upper voices of the chord on each bar line (the lowest note is the left-hand root).
    const uppers = Array.from({ length: song.bars }, (_, bar) =>
      barNotes(song, keys, plan, bar)
        .filter(([step]) => step === 0)
        .map(([, pitch]) => pitch)
        .sort((a, b) => a - b)
        .slice(1),
    );
    uppers.forEach((voicing, bar) => {
      const next = uppers[(bar + 1) % uppers.length] ?? [];
      expect(voicing).toHaveLength(4);
      expect(largestMove(voicing, next), `bar ${bar} -> ${bar + 1}`).toBeLessThanOrEqual(3);
    });
  });

  it.each(ALL)('%s: rest bars are inside the loop and not its last bar', (_, song) => {
    for (const part of song.parts) {
      for (const bar of part.restBars ?? []) {
        expect(bar).toBeGreaterThanOrEqual(0);
        expect(bar).toBeLessThan(song.bars - 1);
      }
    }
  });

  it.each(ALL)('%s: a sparse melody: phrases of a few notes, every phrase has rests', (_, song) => {
    const melody = song.parts.findIndex((part) => part.id === 'melody');
    for (const plan of plans(song)) {
      for (let first = 0; first < song.bars; first += 4) {
        let notes = 0;
        let empty = 0;
        for (let bar = first; bar < first + 4; bar++) {
          const n = barNotes(song, melody, plan, bar).length;
          notes += n;
          if (n === 0) empty += 1;
        }
        expect(notes).toBeLessThanOrEqual(6);
        expect(empty).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('the default tune plays the fewest notes per minute and changes chords least often', () => {
    const density = (song: Song): number => {
      const plan = planLoop(song, 1, 0);
      let notes = 0;
      song.parts.forEach((_, index) => {
        for (let bar = 0; bar < song.bars; bar++) notes += barNotes(song, index, plan, bar).length;
      });
      return notes / (songTiming(song).loopSec / 60);
    };
    const changes = (song: Song): number =>
      song.chords.filter((c, i) => c.name !== song.chords[(i + 1) % song.bars]?.name).length;
    const chosen = SONGS[DEFAULT_MUSIC_VARIANT];
    for (const [, song] of ALL) {
      expect(density(chosen)).toBeLessThanOrEqual(density(song));
      expect(changes(chosen)).toBeLessThanOrEqual(changes(song));
    }
  });

  it('the menu plays layers 1-2, quieter than the run', () => {
    expect(MUSIC_PLAY.menuLayer).toBe(2);
    expect(MUSIC_PLAY.menuLevel).toBeLessThan(1);
  });
});

import { Rng } from '../../../core/rng';
import { MUSIC_PLAY } from '../../../data/music/music-play';
import type { Bar, Song } from '../../../data/music/song';
import { UINT32_RANGE } from '../../../util/math';

/**
 * The pure side of the music player: song timing, the variation plan of each loop, the fade of
 * the parts between layers and the notes that start in a window of song time. No Web Audio here;
 * `tune-player.ts` turns the events into voices. Song time is seconds from the first bar line.
 */

export interface SongTiming {
  stepSec: number;
  stepsPerBar: number;
  barSec: number;
  loopSec: number;
}

export function songTiming(song: Song): SongTiming {
  const stepSec = 60 / song.bpm / song.stepsPerBeat;
  const stepsPerBar = song.beatsPerBar * song.stepsPerBeat;
  return {
    stepSec,
    stepsPerBar,
    barSec: stepsPerBar * stepSec,
    loopSec: song.bars * stepsPerBar * stepSec,
  };
}

/** Pitch class (0..11) of a pitch in semitones from C. */
export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** What one loop of the song plays: the phrase picks, the rests and the fill. */
export interface LoopPlan {
  /** Per part: the alternative chosen for each slot of its form. */
  picks: number[][];
  /** Per part: the bar of the loop it leaves out, or null. */
  rest: Array<number | null>;
  /** The loop ends with the fills of the parts that have one. */
  fill: boolean;
}

/** Spreads the loop index over the seed so neighbouring loops get unrelated draws. */
const LOOP_MIX = 0x9e3779b1;

/**
 * The variation of loop `loop` (0 = the first): the first loop plays the plain form; later loops
 * pick among the alternatives of each slot, may rest a bar (`restChance`) and may end with the
 * fill (`fillChance`). The same seed and loop always give the same plan.
 */
export function planLoop(song: Song, seed: number, loop: number): LoopPlan {
  if (loop <= 0) {
    return {
      picks: song.parts.map((part) => part.form.map(() => 0)),
      rest: song.parts.map(() => null),
      fill: false,
    };
  }
  const rng = new Rng((seed ^ Math.imul(loop, LOOP_MIX)) >>> 0);
  const fill = rng.next() < song.fillChance;
  const picks = song.parts.map((part) =>
    part.form.map((slot) => (typeof slot === 'string' ? 0 : Math.floor(rng.next() * slot.length))),
  );
  const rest = song.parts.map((part) => {
    const bars = part.restBars ?? [];
    const roll = rng.next();
    const which = rng.next();
    if (bars.length === 0 || roll >= song.restChance) return null;
    return bars[Math.floor(which * bars.length)] ?? null;
  });
  return { picks, rest, fill };
}

/** The notes of bar `bar` (0-based in the loop) of part `index` under `plan`, rests left aside. */
export function barNotes(song: Song, index: number, plan: LoopPlan, bar: number): Bar {
  const part = song.parts[index];
  if (!part) return [];
  if (plan.fill && part.fill && bar === song.bars - 1) return part.fill;
  let first = 0;
  for (let slot = 0; slot < part.form.length; slot++) {
    const entry = part.form[slot];
    const id = typeof entry === 'string' ? entry : entry?.[plan.picks[index]?.[slot] ?? 0];
    const phrase = id === undefined ? undefined : part.phrases[id];
    if (!phrase) continue;
    if (bar < first + phrase.length) return phrase[bar - first] ?? [];
    first += phrase.length;
  }
  return [];
}

/** The loudness share of a part: `from` until `start`, a straight line to `to` at `end`. */
export interface PartLevel {
  from: number;
  to: number;
  start: number;
  end: number;
}

export function levelAt(level: PartLevel, time: number): number {
  if (time <= level.start) return level.from;
  if (time >= level.end) return level.to;
  return level.from + ((level.to - level.from) * (time - level.start)) / (level.end - level.start);
}

/** A layer as a whole number 1..layers; anything else counts as 1. */
export function clampLayer(layer: number): number {
  if (!Number.isFinite(layer)) return 1;
  return Math.max(1, Math.min(MUSIC_PLAY.layers, Math.floor(layer)));
}

/** The levels of a song that starts at `layer`: every part already where it belongs. */
export function initialLevels(song: Song, layer: number): PartLevel[] {
  const top = clampLayer(layer);
  return song.parts.map((part) => {
    const on = part.layer <= top ? 1 : 0;
    return { from: on, to: on, start: 0, end: 0 };
  });
}

/**
 * The levels after a change to `layer` asked at song time `at`: a part that joins fades in over
 * `fadeInBars` from the next bar line, one that leaves fades out over `fadeOutBars`; a part
 * already heading where it belongs keeps its fade.
 */
export function retargetLevels(
  song: Song,
  levels: readonly PartLevel[],
  layer: number,
  at: number,
): PartLevel[] {
  const { barSec } = songTiming(song);
  const top = clampLayer(layer);
  const barLine = Math.ceil(at / barSec - 1e-9) * barSec;
  return song.parts.map((part, i) => {
    const current = levels[i] ?? { from: 0, to: 0, start: 0, end: 0 };
    const target = part.layer <= top ? 1 : 0;
    if (current.to === target) return current;
    const from = levelAt(current, barLine);
    const bars = target > from ? MUSIC_PLAY.fadeInBars : MUSIC_PLAY.fadeOutBars;
    return { from, to: target, start: barLine, end: barLine + bars * barSec };
  });
}

/** The music layer of a zone (index 0..5) on the run: one more per zone; at most 3 on the minimal effects level. */
export function zoneLayer(zoneIndex: number, minimalEffects: boolean): number {
  const layer = clampLayer(zoneIndex + 1);
  return minimalEffects ? Math.min(layer, MUSIC_PLAY.minimalLayerCap) : layer;
}

/** A note to play: song time and length in seconds, pitch in semitones from C4, gain linear. */
export interface NoteEvent {
  time: number;
  part: number;
  pitch: number;
  length: number;
  gain: number;
}

function heard(level: PartLevel | undefined, time: number): boolean {
  return level !== undefined && levelAt(level, time) > MUSIC_PLAY.silentLevel;
}

/**
 * Every note that starts in [from, to) of song time, in time order. A bar rest is skipped when
 * no other part is heard at that bar (a lone lead never falls silent).
 */
export function scheduleWindow(
  song: Song,
  seed: number,
  levels: readonly PartLevel[],
  from: number,
  to: number,
): NoteEvent[] {
  if (!(to > from)) return [];
  const { stepSec, stepsPerBar, barSec } = songTiming(song);
  const firstBar = Math.max(0, Math.floor(from / barSec));
  const lastBar = Math.floor(to / barSec);
  const plans = new Map<number, LoopPlan>();
  const events: NoteEvent[] = [];
  for (let absBar = firstBar; absBar <= lastBar; absBar++) {
    const loop = Math.floor(absBar / song.bars);
    const bar = absBar - loop * song.bars;
    let plan = plans.get(loop);
    if (!plan) {
      plan = planLoop(song, seed, loop);
      plans.set(loop, plan);
    }
    const barStart = absBar * stepsPerBar * stepSec;
    song.parts.forEach((part, index) => {
      if (plan.rest[index] === bar) {
        const others = levels.some((level, other) => other !== index && heard(level, barStart));
        if (others) return;
      }
      for (const [step, pitch, length, velocity = 1] of barNotes(song, index, plan, bar)) {
        const time = (absBar * stepsPerBar + step) * stepSec;
        if (time < from || time >= to) continue;
        const level = levels[index];
        if (!level || !heard(level, time)) continue;
        const gain = song.gain * part.gain * velocity * levelAt(level, time);
        events.push({ time, part: index, pitch, length: length * stepSec, gain });
      }
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

/** A fresh seed of the variations from a random source. */
export function variationSeed(random: () => number): number {
  return Math.floor(random() * UINT32_RANGE) >>> 0;
}

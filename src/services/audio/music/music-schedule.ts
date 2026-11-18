import { Rng } from '../../../core/rng';
import { MUSIC_PLAY } from '../../../data/music/music-play';
import type { Bar, Song } from '../../../data/music/song';

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

/** The music layer of a zone (index 0..5) on the run: one more per zone; without layer 6 on the minimal effects level. */
export function zoneLayer(zoneIndex: number, minimalEffects: boolean): number {
  const layer = clampLayer(zoneIndex + 1);
  return minimalEffects ? Math.min(layer, MUSIC_PLAY.minimalLayerCap) : layer;
}

/**
 * The swung position of `step` in steps from the bar line: the second eighth of each beat lands
 * at `swing` of the beat, the sixteenths in between follow proportionally (straight at 0.5).
 */
export function swingStep(step: number, stepsPerBeat: number, swing: number): number {
  const beat = Math.floor(step / stepsPerBeat);
  const frac = step / stepsPerBeat - beat;
  const bent = frac < 0.5 ? frac * 2 * swing : swing + (frac - 0.5) * 2 * (1 - swing);
  return (beat + bent) * stepsPerBeat;
}

/** Spreads the bar, part and note index over the seed so neighbouring notes get unrelated draws. */
const NOTE_MIX = [0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f] as const;

/**
 * The seeded looseness of one note (the same note always gets the same): a time shift within
 * +-`timeSec` (plus `late.sec` with `late.chance`) and a velocity factor within 1 +- `velocity`.
 */
export function humanizeNote(
  seed: number,
  absBar: number,
  part: number,
  index: number,
  spec: { timeSec: number; velocity: number },
  late?: { chance: number; sec: number },
): { shift: number; velocity: number } {
  const mixed =
    seed ^
    Math.imul(absBar + 1, NOTE_MIX[0]) ^
    Math.imul(part + 1, NOTE_MIX[1]) ^
    Math.imul(index + 1, NOTE_MIX[2]);
  const rng = new Rng(mixed >>> 0);
  const shift = (rng.next() * 2 - 1) * spec.timeSec;
  const velocity = 1 + (rng.next() * 2 - 1) * spec.velocity;
  const lazy = late !== undefined && rng.next() < late.chance ? late.sec : 0;
  return { shift: shift + lazy, velocity };
}

/** The furthest a note may be moved from its swung place (humanize plus a lazy hit). */
function maxShift(song: Song): number {
  const late = Math.max(0, ...song.parts.map((part) => part.late?.sec ?? 0));
  return song.humanize.timeSec + late;
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
 * Every note that sounds from [from, to) of song time (its swung and humanized time), in time
 * order. A bar rest is skipped when no other part is heard at that bar (a lone part never falls
 * silent). `plans` caches the plan of each loop: a caller that asks window after window passes
 * the same map to build each once. A note belongs to exactly one window, so windows add up.
 */
export function scheduleWindow(
  song: Song,
  seed: number,
  levels: readonly PartLevel[],
  from: number,
  to: number,
  plans: Map<number, LoopPlan> = new Map(),
): NoteEvent[] {
  if (!(to > from)) return [];
  const { stepSec, barSec } = songTiming(song);
  const margin = maxShift(song);
  const firstBar = Math.max(0, Math.floor((from - margin) / barSec));
  const lastBar = Math.floor((to + margin) / barSec);
  const events: NoteEvent[] = [];
  for (let absBar = firstBar; absBar <= lastBar; absBar++) {
    const loop = Math.floor(absBar / song.bars);
    const bar = absBar - loop * song.bars;
    let plan = plans.get(loop);
    if (!plan) {
      plan = planLoop(song, seed, loop);
      plans.set(loop, plan);
    }
    const barStart = absBar * barSec;
    song.parts.forEach((part, index) => {
      if (plan.rest[index] === bar) {
        const others = levels.some((level, other) => other !== index && heard(level, barStart));
        if (others) return;
      }
      const level = levels[index];
      if (!level) return;
      barNotes(song, index, plan, bar).forEach(([step, pitch, length, velocity = 1], n) => {
        const grid = barStart + swingStep(step, song.stepsPerBeat, song.swing) * stepSec;
        const loose = humanizeNote(seed, absBar, index, n, song.humanize, part.late);
        const time = Math.max(0, grid + loose.shift);
        if (time < from || time >= to || !heard(level, time)) return;
        const gain = song.gain * part.gain * velocity * loose.velocity * levelAt(level, time);
        events.push({ time, part: index, pitch, length: length * stepSec, gain });
      });
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

/** Spreads the beat index over the seed for the crackle draws. */
const CRACKLE_MIX = 0x632be5ab;

/**
 * The vinyl crackles of [from, to) of song time: in each beat one crackle with `chance`, at a
 * seeded place in the beat, with a seeded strength (0..1) and playback rate (0..1, mapped by the
 * caller). The same seed always gives the same crackles; windows add up.
 */
export function crackleWindow(
  seed: number,
  beatSec: number,
  chance: number,
  from: number,
  to: number,
): Array<{ time: number; strength: number; rate: number }> {
  if (!(to > from) || chance <= 0) return [];
  const out: Array<{ time: number; strength: number; rate: number }> = [];
  for (let beat = Math.max(0, Math.floor(from / beatSec)); beat * beatSec < to; beat++) {
    const rng = new Rng((seed ^ Math.imul(beat + 1, CRACKLE_MIX)) >>> 0);
    if (rng.next() >= chance) continue;
    const time = (beat + rng.next()) * beatSec;
    const strength = rng.next();
    const rate = rng.next();
    if (time >= from && time < to) out.push({ time, strength, rate });
  }
  return out;
}

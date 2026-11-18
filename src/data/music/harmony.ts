/**
 * Harmony of the lofi tunes (docs/06-art-animation-audio.md, section 7, "Музыка"): chord
 * symbols, the rule that keeps the combo bells consonant over every chord, and voice leading
 * for the keys. Pure, used at load time by the tune files and by the tests.
 */

/** Chord qualities: intervals above the root, the chord tones first, then the extensions. */
export const QUALITIES = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 2],
  '6/9': [0, 4, 7, 9, 2],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 2],
  m11: [0, 3, 7, 10, 2, 5],
  '9': [0, 4, 7, 10, 2],
  '13': [0, 4, 7, 10, 2, 9],
  '9sus4': [0, 5, 7, 10, 2],
  '13sus4': [0, 5, 7, 10, 2, 9],
} as const satisfies Record<string, readonly number[]>;

export type Quality = keyof typeof QUALITIES;

/**
 * What the keys play of each quality: four voices without the root (the bass has it), in
 * intervals above the root. A rootless voicing is what makes the chord sound soft and "jazzy".
 */
export const VOICINGS: Readonly<Record<Quality, readonly number[]>> = {
  maj7: [4, 7, 11, 12],
  maj9: [4, 7, 11, 2],
  '6/9': [4, 9, 2, 7],
  m7: [3, 7, 10, 12],
  m9: [3, 7, 10, 2],
  m11: [3, 10, 2, 5],
  '9': [4, 10, 2, 7],
  '13': [4, 10, 2, 9],
  '9sus4': [5, 10, 2, 7],
  '13sus4': [5, 10, 2, 9],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

export interface Chord {
  /** Symbol for the docs and the tests: `Cmaj9`, `Dm9/C`. */
  name: string;
  /** Pitch class of the root (0 = C). */
  root: number;
  /** Pitch class of the bass note: the root, or another tone in a slash chord. */
  bass: number;
  /** Every pitch class of the chord, extensions included. */
  tones: readonly number[];
  /** Pitch class of the seventh (b7 or maj7), or null for a chord without one. */
  seventh: number | null;
  /** Pitch classes the keys play (`VOICINGS`). */
  voice: readonly number[];
}

/** Pitch class (0..11) of a pitch in semitones from C. */
export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

function pcOf(name: NoteName): number {
  return NOTE_NAMES.indexOf(name);
}

/** A chord from its root, quality and optional slash bass: `chord('D', 'm9', 'C')` is Dm9/C. */
export function chord(root: NoteName, quality: Quality, bass: NoteName = root): Chord {
  const r = pcOf(root);
  const intervals: readonly number[] = QUALITIES[quality];
  const seventh = intervals.find((i) => i === 10 || i === 11);
  return {
    name: `${root}${quality}${bass === root ? '' : `/${bass}`}`,
    root: r,
    bass: pcOf(bass),
    tones: intervals.map((i) => pitchClass(r + i)),
    seventh: seventh === undefined ? null : pitchClass(r + seventh),
    voice: VOICINGS[quality].map((i) => pitchClass(r + i)),
  };
}

/**
 * The consonance rule of a pitch class over a chord (the combo bells, the melody): a chord tone
 * always fits; any other note fits unless it lies a semitone above a chord tone (a minor ninth,
 * the classic "avoid note") or a semitone below one, the seventh excepted (a 13th under a b7 is a
 * soft tension, a 3rd under a sus4 is not).
 */
export function fitsChord(chordOf: Chord, pc: number): boolean {
  const p = pitchClass(pc);
  if (chordOf.tones.includes(p)) return true;
  return !chordOf.tones.some((tone) => {
    if (pitchClass(p - tone) === 1) return true;
    return pitchClass(tone - p) === 1 && tone !== chordOf.seventh;
  });
}

/** Penalties of the voice leading: a minor second between neighbouring voices, a second low down, a leap. */
const LEAD = {
  rubCost: 4,
  lowSecondCost: 8,
  lowSecondBelow: -5,
  maxSpan: 17,
  /** A voice that moves more than `stepMax` semitones costs this much per extra semitone. */
  leapCost: 2,
  stepMax: 2,
  /** Cost per semitone of the middle of a voicing away from the asked register. */
  centerCost: 0.5,
} as const;

/** Every combination of one pitch per pitch class inside [low, high], sorted low to high. */
function candidates(pcs: readonly number[], low: number, high: number): number[][] {
  let out: number[][] = [[]];
  for (const pc of pcs) {
    const options: number[] = [];
    for (let p = low; p <= high; p++) if (pitchClass(p) === pitchClass(pc)) options.push(p);
    out = out.flatMap((combo) => options.map((p) => [...combo, p]));
  }
  return out
    .map((combo) => [...combo].sort((a, b) => a - b))
    .filter((combo) => {
      const first = combo[0] ?? 0;
      const last = combo[combo.length - 1] ?? 0;
      return new Set(combo).size === combo.length && last - first <= LEAD.maxSpan;
    });
}

function roughness(voices: readonly number[]): number {
  let cost = 0;
  for (let i = 1; i < voices.length; i++) {
    const a = voices[i - 1] ?? 0;
    const b = voices[i] ?? 0;
    if (b - a === 1) cost += LEAD.rubCost;
    if (b - a <= 2 && a < LEAD.lowSecondBelow) cost += LEAD.lowSecondCost;
  }
  return cost;
}

/** Sum of the moves of each voice (both sorted low to high). */
export function voiceMotion(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, p, i) => sum + Math.abs((b[i] ?? p) - p), 0);
}

/** The largest move of one voice between two voicings (sorted low to high). */
export function largestMove(a: readonly number[], b: readonly number[]): number {
  return a.reduce((most, p, i) => Math.max(most, Math.abs((b[i] ?? p) - p)), 0);
}

/** Cost of moving from voicing `a` to `b`: the motion, extra for a leap, and the roughness of `b`. */
function stepCost(a: readonly number[], b: readonly number[]): number {
  const leap = Math.max(0, largestMove(a, b) - LEAD.stepMax);
  return voiceMotion(a, b) + LEAD.leapCost * leap + roughness(b);
}

/**
 * The voicings of a looping progression inside [low, high]: of all the ways to voice the chords,
 * the one with the least motion (each step and the step from the last chord back to the first),
 * the fewest leaps and rubs, and its middle near `center` (weighted by `LEAD.centerCost`).
 * Searched exactly: for each voicing of the first chord, the best path round the loop.
 */
export function leadProgression(
  chords: readonly Chord[],
  low: number,
  high: number,
  center: number,
): number[][] {
  const options = chords.map((c) => candidates(c.voice, low, high));
  const place = (v: readonly number[]): number =>
    LEAD.centerCost * Math.abs(v.reduce((s, p) => s + p, 0) / v.length - center);
  let best: number[][] = [];
  let bestCost = Infinity;
  for (const first of options[0] ?? []) {
    // cost[j]: the cheapest way from `first` to option j of the current chord; back[i][j] its predecessor.
    let cost = [place(first) + roughness(first)];
    let layer: readonly (readonly number[])[] = [first];
    const back: number[][] = [];
    for (let i = 1; i < options.length; i++) {
      const next = options[i] ?? [];
      const row: number[] = [];
      const from: number[] = [];
      for (const b of next) {
        let min = Infinity;
        let arg = 0;
        layer.forEach((a, k) => {
          const c = (cost[k] ?? Infinity) + stepCost(a, b);
          if (c < min) {
            min = c;
            arg = k;
          }
        });
        row.push(min + place(b));
        from.push(arg);
      }
      cost = row;
      layer = next;
      back.push(from);
    }
    layer.forEach((last, k) => {
      const total = (cost[k] ?? Infinity) + (options.length > 1 ? stepCost(last, first) : 0);
      if (total >= bestCost) return;
      bestCost = total;
      const path: number[][] = [];
      let j = k;
      for (let i = options.length - 1; i >= 1; i--) {
        path.unshift([...(options[i]?.[j] ?? [])]);
        j = back[i - 1]?.[j] ?? 0;
      }
      best = [[...first], ...path];
    });
  }
  return best;
}

/** The pitch of the bass note of `c` in [low, low + 11]. */
export function bassPitch(c: Chord, low: number): number {
  return low + pitchClass(c.bass - low);
}

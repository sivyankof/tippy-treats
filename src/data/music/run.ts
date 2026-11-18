import { arpeggio, chord, hits, repeat } from './note-tools';
import type { Bar, Song } from './song';

/**
 * Variant C, "Бодрая" (upbeat run): 4/4 at 126 bpm, sixteenth-note steps (16 per bar), 16 bars
 * (about 30 s). Harmony C | Am | F | G, a lift to F | G | Am | Am in the middle. Pitches are
 * semitones from C4: 9 = A4, 12 = C5, 14 = D5, 16 = E5, 19 = G5, 21 = A5, 24 = C6.
 *
 * Layers: 1 the bright plucky lead, 2 a soft kick on every beat, 3 a plucky octave bass,
 * 4 a shaker, 5 offbeat chord stabs, 6 a high celesta arpeggio.
 */

type Chord = 'C' | 'Am' | 'F' | 'G' | 'FG';

const HOOK: Bar = [
  [0, 19, 3],
  [3, 16, 1, 0.7],
  [4, 19, 2, 0.85],
  [6, 21, 2, 0.85],
  [8, 19, 3, 0.9],
  [11, 16, 1, 0.7],
  [12, 14, 2, 0.8],
  [14, 12, 2, 0.8],
];
const HOOK_ANSWER: Bar = [
  [0, 9, 2, 0.85],
  [2, 12, 2, 0.8],
  [4, 16, 4, 0.9],
  [8, 14, 2, 0.8],
  [10, 12, 2, 0.8],
  [12, 9, 4, 0.85],
];

const lead = {
  A: [
    HOOK,
    HOOK_ANSWER,
    [
      [0, 12, 2, 0.85],
      [2, 9, 2, 0.8],
      [4, 12, 2, 0.8],
      [6, 14, 2, 0.85],
      [8, 16, 3, 0.9],
      [11, 14, 1, 0.7],
      [12, 12, 4, 0.85],
    ],
    [
      [0, 14, 4, 0.9],
      [4, 7, 2, 0.75],
      [6, 9, 2, 0.8],
      [8, 14, 6, 0.9],
    ],
  ],
  A2: [
    HOOK,
    [
      [0, 9, 2, 0.85],
      [2, 12, 2, 0.8],
      [4, 16, 2, 0.85],
      [6, 19, 2, 0.85],
      [8, 21, 4],
      [12, 19, 2, 0.8],
      [14, 16, 2, 0.8],
    ],
    [
      [0, 21, 3],
      [3, 19, 1, 0.7],
      [4, 16, 2, 0.85],
      [6, 14, 2, 0.8],
      [8, 12, 2, 0.8],
      [10, 14, 2, 0.8],
      [12, 16, 4, 0.9],
    ],
    [
      [0, 14, 6, 0.9],
      [8, 16, 2, 0.8],
      [10, 19, 2, 0.85],
      [12, 21, 4, 0.9],
    ],
  ],
  A2b: [
    HOOK,
    [
      [0, 21, 2, 0.9],
      [2, 19, 2, 0.8],
      [4, 16, 2, 0.8],
      [6, 12, 2, 0.8],
      [8, 9, 4, 0.85],
      [12, 12, 4, 0.85],
    ],
    [
      [0, 21, 3],
      [3, 19, 1, 0.7],
      [4, 16, 2, 0.85],
      [6, 14, 2, 0.8],
      [8, 12, 2, 0.8],
      [10, 14, 2, 0.8],
      [12, 16, 4, 0.9],
    ],
    [
      [0, 14, 4, 0.9],
      [4, 16, 2, 0.8],
      [6, 14, 2, 0.75],
      [8, 19, 4, 0.85],
      [12, 21, 4, 0.9],
    ],
  ],
  B: [
    [
      [0, 24, 6],
      [6, 21, 2, 0.8],
      [8, 19, 4, 0.85],
      [12, 21, 4, 0.85],
    ],
    [
      [0, 19, 6, 0.95],
      [6, 14, 2, 0.8],
      [8, 16, 4, 0.85],
      [12, 19, 4, 0.85],
    ],
    [
      [0, 21, 4],
      [4, 16, 2, 0.8],
      [6, 19, 2, 0.8],
      [8, 21, 2, 0.85],
      [10, 24, 2, 0.9],
      [12, 21, 4, 0.85],
    ],
    [
      [0, 16, 6, 0.9],
      [8, 14, 2, 0.8],
      [10, 16, 2, 0.8],
      [12, 19, 4, 0.85],
    ],
  ],
  B2: [
    [
      [0, 21, 2, 0.9],
      [2, 24, 2, 0.9],
      [4, 21, 2, 0.8],
      [6, 19, 2, 0.8],
      [8, 21, 6, 0.9],
      [14, 19, 2, 0.75],
    ],
    [
      [0, 14, 2, 0.85],
      [2, 16, 2, 0.8],
      [4, 19, 4, 0.9],
      [8, 26, 6, 0.85],
      [14, 24, 2, 0.75],
    ],
    [
      [0, 21, 3],
      [3, 19, 1, 0.7],
      [4, 16, 4, 0.85],
      [8, 12, 2, 0.8],
      [10, 16, 2, 0.8],
      [12, 21, 4, 0.9],
    ],
    [
      [0, 16, 8, 0.9],
      [12, 19, 2, 0.8],
      [14, 16, 2, 0.75],
    ],
  ],
  A3: [
    HOOK,
    HOOK_ANSWER,
    [
      [0, 12, 2, 0.85],
      [2, 9, 2, 0.8],
      [4, 12, 2, 0.8],
      [6, 14, 2, 0.85],
      [8, 14, 2, 0.85],
      [10, 16, 2, 0.85],
      [12, 19, 4, 0.9],
    ],
    [
      [0, 24, 4, 0.95],
      [4, 19, 2, 0.8],
      [6, 16, 2, 0.8],
      [8, 12, 5, 0.9],
      [14, 16, 2, 0.6],
    ],
  ],
} satisfies Record<string, Bar[]>;

/** The lead's cascade at the end of some loops: down from C6 and back up. */
const LEAD_FILL: Bar = [
  [0, 24, 2, 0.9],
  [2, 21, 2, 0.8],
  [4, 19, 2, 0.8],
  [6, 16, 2, 0.8],
  [8, 14, 1, 0.7],
  [9, 16, 1, 0.7],
  [10, 19, 1, 0.75],
  [11, 21, 1, 0.8],
  [12, 24, 4, 0.9],
];

const KICK: Bar = hits([
  [0, 1],
  [4, 0.7],
  [8, 0.9],
  [12, 0.7],
]);
const KICK_FILL: Bar = hits([
  [0, 1],
  [4, 0.7],
  [8, 0.9],
  [10, 0.6],
  [12, 0.8],
  [14, 0.9],
]);

/** Bass roots (low) and their octaves: C3, A2, F2, G2. */
const ROOT: Record<Exclude<Chord, 'FG'>, number> = { C: -12, Am: -15, F: -19, G: -17 };
const BASS_ORDER = [0, 1];
const BASS_VEL = [0.95, 0.6];

function bassHalf(root: number, start: number, count: number): Bar {
  return arpeggio([root, root + 12], {
    start,
    every: 2,
    count,
    length: 1,
    order: BASS_ORDER,
    velocities: BASS_VEL,
  });
}

const BASS: Record<Chord, Bar> = {
  C: bassHalf(ROOT.C, 0, 8),
  Am: bassHalf(ROOT.Am, 0, 8),
  F: bassHalf(ROOT.F, 0, 8),
  G: bassHalf(ROOT.G, 0, 8),
  FG: [...bassHalf(ROOT.F, 0, 4), ...bassHalf(ROOT.G, 8, 4)],
};

/** Shaker sixteenths: the offbeat eighth is the loud one. */
const SHAKER: Bar = hits(
  Array.from({ length: 16 }, (_, i) => [i, i % 4 === 2 ? 0.8 : i % 2 === 0 ? 0.4 : 0.25] as const),
);

/** Stab dyads on the "and" of beats 2 and 4. */
const STAB_TONES: Record<Exclude<Chord, 'FG'>, readonly number[]> = {
  C: [4, 7],
  Am: [4, 9],
  F: [0, 9],
  G: [2, 7],
};

function stabBar(first: Exclude<Chord, 'FG'>, second = first): Bar {
  return [...chord(STAB_TONES[first], 6, 2, 0.8), ...chord(STAB_TONES[second], 14, 2, 0.7)];
}

const STAB: Record<Chord, Bar> = {
  C: stabBar('C'),
  Am: stabBar('Am'),
  F: stabBar('F'),
  G: stabBar('G'),
  FG: stabBar('F', 'G'),
};

/** High arpeggio tones, C5..D6 (pentatonic only). */
const SPARKLE_TONES: Record<Exclude<Chord, 'FG'>, readonly number[]> = {
  C: [12, 16, 19, 24],
  Am: [9, 12, 16, 21],
  F: [9, 12, 21, 24],
  G: [7, 14, 19, 26],
};
const SPARKLE_VEL = [0.8, 0.45, 0.6, 0.45];

function sparkleHalf(tones: readonly number[], start: number, order: readonly number[]): Bar {
  return arpeggio(tones, { start, every: 2, count: 4, length: 2, order, velocities: SPARKLE_VEL });
}

function sparkleBar(first: Exclude<Chord, 'FG'>, second = first): Bar {
  return [
    ...sparkleHalf(SPARKLE_TONES[first], 0, [0, 1, 2, 3]),
    ...sparkleHalf(SPARKLE_TONES[second], 8, [3, 2, 1, 0]),
  ];
}

const SPARKLE: Record<Chord, Bar> = {
  C: sparkleBar('C'),
  Am: sparkleBar('Am'),
  F: sparkleBar('F'),
  G: sparkleBar('G'),
  FG: sparkleBar('F', 'G'),
};

/** The harmony of each phrase, laid out for one part's bars. */
function byHarmony(bars: Record<Chord, Bar>): Record<string, Bar[]> {
  return {
    A: [bars.C, bars.Am, bars.F, bars.G],
    B: [bars.F, bars.G, bars.Am, bars.Am],
    A3: [bars.C, bars.Am, bars.FG, bars.C],
  };
}

export const RUN: Song = {
  name: 'run',
  bpm: 126,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 16,
  gain: 1.26,
  restChance: 0.35,
  fillChance: 0.5,
  parts: [
    {
      id: 'lead',
      instrument: 'brightPluck',
      layer: 1,
      gain: 0.2,
      scale: 'penta',
      phrases: lead,
      form: ['A', ['A2', 'A2b'], ['B', 'B2'], 'A3'],
      restBars: [3, 7],
      fill: LEAD_FILL,
    },
    {
      id: 'kick',
      instrument: 'kick',
      layer: 2,
      gain: 0.28,
      scale: 'unpitched',
      phrases: { T: repeat(4, KICK) },
      form: ['T', 'T', 'T', 'T'],
      fill: KICK_FILL,
    },
    {
      id: 'bass',
      instrument: 'pluckBass',
      layer: 3,
      gain: 0.22,
      scale: 'pentaF',
      phrases: byHarmony(BASS),
      form: ['A', 'A', 'B', 'A3'],
    },
    {
      id: 'shaker',
      instrument: 'shaker',
      layer: 4,
      gain: 0.125,
      scale: 'unpitched',
      phrases: { T: repeat(4, SHAKER) },
      form: ['T', 'T', 'T', 'T'],
    },
    {
      id: 'stabs',
      instrument: 'stab',
      layer: 5,
      gain: 0.07,
      scale: 'penta',
      phrases: byHarmony(STAB),
      form: ['A', 'A', 'B', 'A3'],
      restBars: [3, 11],
    },
    {
      id: 'sparkle',
      instrument: 'celesta',
      layer: 6,
      gain: 0.093,
      scale: 'penta',
      phrases: byHarmony(SPARKLE),
      form: ['A', 'A', 'B', 'A3'],
    },
  ],
};

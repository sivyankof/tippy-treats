import { chord, hits, repeat } from './note-tools';
import type { Bar, Song } from './song';

/**
 * Variant B, "Вальс кондитерской" (bakery waltz): a cosy 3/4 waltz at 150 bpm, eighth-note steps
 * (6 per bar), 32 bars (about 38 s). Pitches are semitones from C4: 7 = G4, 12 = C5, 16 = E5,
 * 19 = G5, 21 = A5, 24 = C6. The melody keeps to the C major pentatonic.
 *
 * Layers: 1 the lead (a soft square, like through a lowpass), 2 the "oom" bass on beat 1,
 * 3 the "pah-pah" chords on beats 2 and 3, 4 an accordion-like pad of two detuned reeds,
 * 5 a brush, 6 a high bell counter-melody.
 */

type Chord = 'C' | 'G' | 'Am' | 'F';

/** The chords of the 8-bar phrases: A (and A2) and B. */
const HARMONY_A: readonly Chord[] = ['C', 'C', 'G', 'G', 'Am', 'F', 'G', 'C'];
const HARMONY_B: readonly Chord[] = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'];

const LEAD_OPEN: Bar[] = [
  [
    [0, 7, 2, 0.8],
    [2, 12, 2, 0.85],
    [4, 16, 2, 0.9],
  ],
  [
    [0, 19, 4],
    [4, 16, 2, 0.8],
  ],
  [
    [0, 14, 4, 0.95],
    [4, 16, 1, 0.75],
    [5, 14, 1, 0.7],
  ],
  [
    [0, 19, 4, 0.95],
    [4, 14, 2, 0.8],
  ],
];

/** The close of A2: C5 and an A4 that leads on (to E5 of B, or to G4 of the next loop). */
const LEAD_CLOSE: Bar = [
  [0, 12, 4, 0.9],
  [4, 9, 2, 0.55],
];

const lead = {
  A: [
    ...LEAD_OPEN,
    [
      [0, 12, 2, 0.85],
      [2, 16, 2, 0.85],
      [4, 21, 2, 0.9],
    ],
    [
      [0, 21, 4],
      [4, 19, 2, 0.8],
    ],
    [
      [0, 19, 2, 0.9],
      [2, 16, 2, 0.85],
      [4, 14, 2, 0.85],
    ],
    [
      [0, 12, 4, 0.9],
      [4, 4, 2, 0.55],
    ],
  ],
  A2: [
    ...LEAD_OPEN,
    [
      [0, 12, 2, 0.85],
      [2, 16, 2, 0.85],
      [4, 21, 2, 0.9],
    ],
    [
      [0, 24, 4],
      [4, 21, 2, 0.8],
    ],
    [
      [0, 19, 2, 0.9],
      [2, 16, 2, 0.85],
      [4, 14, 2, 0.85],
    ],
    LEAD_CLOSE,
  ],
  A2b: [
    ...LEAD_OPEN,
    [
      [0, 16, 2, 0.85],
      [2, 21, 2, 0.85],
      [4, 24, 2, 0.9],
    ],
    [
      [0, 26, 3],
      [3, 24, 1, 0.75],
      [4, 21, 2, 0.8],
    ],
    [
      [0, 19, 4, 0.9],
      [4, 14, 2, 0.8],
    ],
    LEAD_CLOSE,
  ],
  B: [
    [
      [0, 16, 2, 0.85],
      [2, 21, 4],
    ],
    [
      [0, 19, 2, 0.85],
      [2, 16, 2, 0.8],
      [4, 12, 2, 0.8],
    ],
    [
      [0, 21, 2, 0.85],
      [2, 24, 4],
    ],
    [
      [0, 21, 2, 0.85],
      [2, 19, 2, 0.8],
      [4, 16, 2, 0.8],
    ],
    [
      [0, 19, 2, 0.85],
      [2, 16, 4, 0.9],
    ],
    [
      [0, 14, 2, 0.8],
      [2, 16, 2, 0.8],
      [4, 19, 2, 0.85],
    ],
    [
      [0, 21, 4],
      [4, 19, 2, 0.8],
    ],
    [[0, 14, 6, 0.9]],
  ],
  B2: [
    [
      [0, 21, 3],
      [3, 19, 1, 0.75],
      [4, 16, 2, 0.8],
    ],
    [
      [0, 12, 4, 0.9],
      [4, 16, 2, 0.8],
    ],
    [
      [0, 24, 3],
      [3, 21, 1, 0.75],
      [4, 19, 2, 0.8],
    ],
    [[0, 21, 6, 0.9]],
    [
      [0, 16, 3, 0.85],
      [3, 19, 1, 0.75],
      [4, 24, 2, 0.9],
    ],
    [
      [0, 19, 4, 0.9],
      [4, 16, 2, 0.8],
    ],
    [
      [0, 14, 2, 0.8],
      [2, 16, 2, 0.8],
      [4, 19, 2, 0.85],
    ],
    [
      [0, 14, 4, 0.9],
      [4, 7, 2, 0.7],
    ],
  ],
} satisfies Record<string, Bar[]>;

/** The lead's turn at the end of some loops: C5 and a little run back up into the first bar. */
const LEAD_FILL: Bar = [
  [0, 12, 2, 0.9],
  [2, 16, 1, 0.7],
  [3, 19, 1, 0.75],
  [4, 21, 1, 0.8],
  [5, 19, 1, 0.75],
];

/** "Oom": root, or fifth on the second bar of a chord. C3/G2, G2/D3, A2/E3, F2/C3. */
const ROOT: Record<Chord, readonly [number, number]> = {
  C: [-12, -17],
  G: [-17, -10],
  Am: [-15, -8],
  F: [-19, -12],
};

function oomBars(harmony: readonly Chord[]): Bar[] {
  return harmony.map((name, i) => {
    const fifth = i > 0 && harmony[i - 1] === name;
    return [[0, ROOT[name][fifth ? 1 : 0], 2, fifth ? 0.85 : 1]];
  });
}

/** "Pah-pah": two-note chords on beats 2 and 3 (pentatonic voicings). */
const PAH_TONES: Record<Chord, readonly number[]> = {
  C: [4, 7],
  G: [2, 7],
  Am: [0, 4],
  F: [-3, 0],
};

function pahBars(harmony: readonly Chord[]): Bar[] {
  return harmony.map((name) => [
    ...chord(PAH_TONES[name], 2, 1, 0.7),
    ...chord(PAH_TONES[name], 4, 1, 0.55),
  ]);
}

/** The accordion's held line, one note a bar. */
const REED_A = [4, 4, 2, 2, 4, 9, 7, 4];
const REED_B = [4, 4, 9, 9, 7, 4, 2, 2];

function reedBars(line: readonly number[]): Bar[] {
  return line.map((pitch) => [[0, pitch, 6, 0.85]]);
}

const BRUSH: Bar = hits([
  [0, 0.9],
  [2, 0.45],
  [4, 0.55],
]);
const BRUSH_FILL: Bar = hits([
  [0, 0.9],
  [2, 0.5],
  [3, 0.5],
  [4, 0.7],
  [5, 0.8],
]);

/** Bell answers: high chord tones on the held bars, a three-note reply at the phrase ends. */
const COUNTER = {
  A: [
    [[0, 28, 6, 0.5]],
    [],
    [[0, 26, 6, 0.5]],
    [],
    [[0, 24, 6, 0.5]],
    [],
    [
      [0, 26, 3, 0.5],
      [3, 24, 3, 0.45],
    ],
    [
      [2, 19, 1, 0.5],
      [3, 21, 1, 0.5],
      [4, 24, 2, 0.6],
    ],
  ],
  B: [
    [[0, 28, 6, 0.5]],
    [],
    [[0, 33, 6, 0.4]],
    [],
    [[0, 31, 6, 0.45]],
    [],
    [[0, 26, 6, 0.5]],
    [
      [2, 26, 1, 0.5],
      [3, 28, 1, 0.5],
      [4, 31, 2, 0.5],
    ],
  ],
} satisfies Record<string, Bar[]>;

export const WALTZ: Song = {
  name: 'waltz',
  bpm: 150,
  beatsPerBar: 3,
  stepsPerBeat: 2,
  bars: 32,
  gain: 1,
  restChance: 0.35,
  fillChance: 0.5,
  parts: [
    {
      id: 'lead',
      instrument: 'musette',
      layer: 1,
      gain: 0.2,
      scale: 'penta',
      phrases: lead,
      form: ['A', ['A2', 'A2b'], ['B', 'B2'], ['A2', 'A2b']],
      restBars: [11, 19],
      fill: LEAD_FILL,
    },
    {
      id: 'oom',
      instrument: 'softBass',
      layer: 2,
      gain: 0.29,
      scale: 'pentaF',
      phrases: { A: oomBars(HARMONY_A), B: oomBars(HARMONY_B) },
      form: ['A', 'A', 'B', 'A'],
    },
    {
      id: 'pah',
      instrument: 'pluck',
      layer: 3,
      gain: 0.14,
      scale: 'penta',
      phrases: { A: pahBars(HARMONY_A), B: pahBars(HARMONY_B) },
      form: ['A', 'A', 'B', 'A'],
    },
    {
      id: 'reeds',
      instrument: 'accordion',
      layer: 4,
      gain: 0.065,
      scale: 'penta',
      phrases: { A: reedBars(REED_A), B: reedBars(REED_B) },
      form: ['A', 'A', 'B', 'A'],
      restBars: [7, 23],
    },
    {
      id: 'brush',
      instrument: 'brush',
      layer: 5,
      gain: 0.16,
      scale: 'unpitched',
      phrases: { T: repeat(8, BRUSH) },
      form: ['T', 'T', 'T', 'T'],
      fill: BRUSH_FILL,
    },
    {
      id: 'counter',
      instrument: 'musicBox',
      layer: 6,
      gain: 0.18,
      scale: 'penta',
      phrases: COUNTER,
      form: ['A', 'A', 'B', 'A'],
    },
  ],
};

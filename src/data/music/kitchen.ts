import { chord } from './harmony';
import { lofiSong } from './lofi-kit';
import { silence } from './note-tools';
import type { Bar } from './song';

/**
 * A «Тёплая кухня»: C major, 76 bpm, light swing, the simplest of the three. I-vi-ii-V with
 * ninths, then IV-I/3-ii-V: one chord per bar, 16 bars (50.5 s). Melody on the electric piano,
 * short answers of a counter-line in its rests.
 */

const CHORDS = [
  chord('C', 'maj9'),
  chord('A', 'm9'),
  chord('D', 'm9'),
  chord('G', '9sus4'),
  chord('F', 'maj9'),
  chord('C', 'maj9', 'E'),
  chord('D', 'm9'),
  chord('G', '13sus4'),
  chord('C', 'maj9'),
  chord('A', 'm9'),
  chord('D', 'm9'),
  chord('G', '9sus4'),
  chord('F', 'maj9'),
  chord('A', 'm9'),
  chord('D', 'm9'),
  chord('G', '13sus4'),
];

const EIGHTHS = [
  [0, 0.8],
  [2, 0.4],
  [4, 0.65],
  [6, 0.35],
  [8, 0.75],
  [10, 0.4],
  [12, 0.6],
  [14, 0.45],
] as const;

/** Melody phrases, four bars each (pitch from C4: 12 = C5). */
const MELODY: Record<string, readonly Bar[]> = {
  a1: [
    [
      [6, 16, 2, 0.75],
      [8, 14, 3, 0.65],
    ],
    [[0, 11, 10, 0.7]],
    [],
    [],
  ],
  a1b: [
    [
      [4, 19, 2, 0.6],
      [6, 16, 4, 0.7],
    ],
    [
      [2, 14, 2, 0.55],
      [4, 11, 10, 0.65],
    ],
    [],
    [],
  ],
  a2: [
    [
      [2, 9, 2, 0.65],
      [4, 12, 4, 0.75],
      [10, 16, 5, 0.7],
    ],
    [[0, 14, 12, 0.6]],
    [],
    [],
  ],
  a2b: [
    [
      [8, 12, 3, 0.7],
      [12, 9, 3, 0.6],
    ],
    [[0, 7, 10, 0.6]],
    [],
    [],
  ],
  a3: [
    [
      [6, 19, 2, 0.7],
      [8, 16, 6, 0.7],
    ],
    [
      [8, 12, 3, 0.6],
      [12, 11, 6, 0.6],
    ],
    [[4, 9, 8, 0.55]],
    [],
  ],
  a4: [
    [
      [4, 16, 2, 0.7],
      [6, 14, 2, 0.6],
      [8, 12, 6, 0.7],
    ],
    [[4, 11, 8, 0.6]],
    [[8, 9, 6, 0.55]],
    [],
  ],
  rest: silence(4),
};

/** Counter-line: short answers in the melody's rests (bars 3-4 of each phrase). */
const SECOND: Record<string, readonly Bar[]> = {
  s1: [
    [],
    [],
    [
      [8, 4, 4, 0.5],
      [12, 5, 4, 0.5],
    ],
    [
      [0, 7, 8, 0.5],
      [8, 5, 8, 0.45],
    ],
  ],
  s2: [
    [],
    [],
    [
      [8, 9, 4, 0.5],
      [12, 12, 4, 0.5],
    ],
    [
      [0, 14, 8, 0.5],
      [8, 16, 8, 0.45],
    ],
  ],
  s4: [
    [],
    [],
    [
      [8, 9, 4, 0.5],
      [12, 5, 4, 0.45],
    ],
    [
      [0, 4, 8, 0.5],
      [8, 2, 8, 0.45],
    ],
  ],
};

export const KITCHEN = lofiSong({
  name: 'kitchen',
  bpm: 76,
  swing: 0.56,
  humanize: { timeSec: 0.012, velocity: 0.1 },
  gain: 1,
  chords: CHORDS,
  voicing: { low: -8, high: 14, center: 4 },
  keys: {
    gain: 0.1,
    rootLow: -20,
    patterns: [
      [
        [0, 7, 0.8, true],
        [10, 5, 0.55],
      ],
      [
        [0, 5, 0.8, true],
        [6, 3, 0.5],
        [12, 4, 0.55],
      ],
    ],
  },
  bass: {
    gain: 0.1,
    low: -24,
    patterns: [
      [
        [0, 'root', 7, 0.9],
        [10, 'fifth', 5, 0.6],
      ],
      [
        [0, 'root', 12, 0.9],
        [14, 'root', 2, 0.5],
      ],
    ],
  },
  kick: {
    gain: 0.17,
    patterns: [
      [
        [0, 1],
        [10, 0.7],
      ],
      [
        [0, 1],
        [7, 0.45],
        [10, 0.7],
      ],
    ],
    fill: [[0, 0.8]],
  },
  hat: { gain: 0.05, patterns: [EIGHTHS, [...EIGHTHS, [15, 0.2]]], fill: [] },
  snare: {
    gain: 0.25,
    patterns: [
      [
        [4, 1],
        [12, 1],
      ],
      [
        [4, 1],
        [12, 1],
        [14, 0.2],
      ],
    ],
    fill: [],
    late: { chance: 0.35, sec: 0.02 },
  },
  melody: {
    instrument: 'ep',
    gain: 0.16,
    phrases: MELODY,
    form: [
      ['a1', 'a1b'],
      ['a2', 'a2b', 'rest'],
      ['a3', 'rest'],
      ['a4', 'rest'],
    ],
  },
  second: {
    instrument: 'ep',
    role: 'keys',
    harmony: 'chord',
    gain: 0.08,
    phrases: SECOND,
    form: ['s1', 's2', 's1', 's4'],
    restBars: [2, 6, 10],
  },
  restChance: 0.35,
  fillChance: 0.3,
});

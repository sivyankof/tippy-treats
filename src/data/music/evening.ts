import { chord } from './harmony';
import { lofiSong } from './lofi-kit';
import { silence } from './note-tools';
import type { Bar } from './song';

/**
 * C «Вечер»: F major, 70 bpm (the slowest), a heavy swing, jazzier. ii-V-I turns with ninths,
 * elevenths and thirteenths (Fmaj9, Dm11, Gm9, C13, Am7), one chord per bar, 16 bars (54.9 s).
 * The keys comp on 1 and the "and" of 2, the hat plays a soft ride figure, the melody is a soft
 * sine an octave above the chords, a slow guide-tone line (E-F-F-E) answers under it.
 */

const TURN = [chord('F', 'maj9'), chord('D', 'm11'), chord('G', 'm9'), chord('C', '13')];

const CHORDS = [
  ...TURN,
  chord('F', 'maj9'),
  chord('A', 'm7'),
  chord('G', 'm9'),
  chord('C', '13'),
  ...TURN,
  chord('A', 'm7'),
  chord('D', 'm11'),
  chord('G', 'm9'),
  chord('C', '13'),
];

const MELODY: Record<string, readonly Bar[]> = {
  c1: [
    [
      [4, 21, 2, 0.65],
      [6, 19, 2, 0.55],
      [8, 16, 6, 0.7],
    ],
    [
      [6, 17, 2, 0.55],
      [8, 21, 8, 0.6],
    ],
    [],
    [],
  ],
  c2: [
    [
      [2, 24, 2, 0.6],
      [4, 21, 8, 0.65],
    ],
    [
      [8, 19, 2, 0.5],
      [10, 16, 6, 0.6],
    ],
    [],
    [
      [4, 21, 4, 0.5],
      [8, 22, 6, 0.55],
    ],
  ],
  c3: [
    [
      [8, 16, 2, 0.6],
      [10, 17, 2, 0.55],
      [12, 19, 4, 0.6],
    ],
    [[0, 21, 10, 0.6]],
    [
      [8, 22, 4, 0.55],
      [12, 21, 4, 0.5],
    ],
    [],
  ],
  c4: [
    [
      [4, 19, 2, 0.55],
      [6, 16, 8, 0.6],
    ],
    [
      [8, 17, 2, 0.5],
      [10, 14, 6, 0.55],
    ],
    [],
    [],
  ],
  rest: silence(4),
};

/** The guide-tone line, one held note per bar: the sevenths and thirds that move by a half step. */
const GUIDE = [4, 5, 5, 4, 4, 4, 5, 4, 4, 5, 5, 4, 4, 5, 5, 4];

export const EVENING = lofiSong({
  name: 'evening',
  bpm: 70,
  swing: 0.6,
  humanize: { timeSec: 0.013, velocity: 0.1 },
  gain: 1.06,
  chords: CHORDS,
  voicing: { low: -9, high: 14, center: 3 },
  keys: {
    gain: 0.1,
    rootLow: -20,
    patterns: [
      [
        [0, 5, 0.75, true],
        [6, 4, 0.55],
      ],
      [
        [0, 3, 0.7, true],
        [6, 2, 0.45],
        [10, 5, 0.55],
      ],
    ],
  },
  bass: {
    gain: 0.1,
    low: -24,
    patterns: [
      [
        [0, 'root', 6, 0.85],
        [8, 'fifth', 6, 0.6],
      ],
      [[0, 'root', 14, 0.85]],
    ],
  },
  kick: {
    gain: 0.15,
    patterns: [
      [
        [0, 0.9],
        [10, 0.55],
      ],
      [
        [0, 0.9],
        [6, 0.4],
        [10, 0.55],
      ],
    ],
    fill: [[0, 0.6]],
  },
  hat: {
    gain: 0.05,
    patterns: [
      [
        [0, 0.6],
        [4, 0.5],
        [6, 0.3],
        [8, 0.6],
        [12, 0.5],
        [14, 0.3],
      ],
      [
        [0, 0.6],
        [4, 0.5],
        [8, 0.6],
        [12, 0.5],
        [14, 0.3],
      ],
    ],
    fill: [],
  },
  snare: {
    gain: 0.21,
    patterns: [
      [
        [4, 0.6],
        [12, 0.8],
      ],
      [
        [4, 0.6],
        [12, 0.8],
        [13, 0.15],
      ],
    ],
    fill: [],
    late: { chance: 0.3, sec: 0.02 },
  },
  melody: {
    instrument: 'softSine',
    gain: 0.14,
    phrases: MELODY,
    form: [
      ['c1', 'rest'],
      ['c2', 'rest'],
      ['c3', 'c1'],
      ['c4', 'rest'],
    ],
  },
  second: {
    instrument: 'ep',
    role: 'melody',
    harmony: 'chord',
    gain: 0.07,
    phrases: { guide: GUIDE.map((pitch): Bar => [[2, pitch, 12, 0.45]]) },
    form: ['guide'],
    restBars: [4, 12],
  },
  restChance: 0.35,
  fillChance: 0.3,
});

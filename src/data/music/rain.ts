import { chord } from './harmony';
import { lofiSong } from './lofi-kit';
import { silence } from './note-tools';
import type { Bar, NoteData } from './song';

/**
 * B «Дождь за окном»: A minor, 72 bpm, a lazier swing, sadder and with more space. i-VI-iv-VII
 * with ninths (Am9, Fmaj9, Dm9, G9sus4), each chord held two bars, 16 bars (53.3 s). One long
 * chord per bar, offbeat hats, a melody that leaves half the bars empty, and a second chord line
 * of two high notes that swell slowly.
 */

const CHORDS = [
  chord('A', 'm9'),
  chord('A', 'm9'),
  chord('F', 'maj9'),
  chord('F', 'maj9'),
  chord('D', 'm9'),
  chord('D', 'm9'),
  chord('G', '9sus4'),
  chord('G', '13sus4'),
  chord('A', 'm9'),
  chord('A', 'm9'),
  chord('F', 'maj9'),
  chord('F', 'maj9'),
  chord('D', 'm9'),
  chord('D', 'm9', 'C'),
  chord('G', '9sus4'),
  chord('G', '13sus4'),
];

const MELODY: Record<string, readonly Bar[]> = {
  b1: [
    [
      [8, 7, 2, 0.6],
      [10, 9, 2, 0.65],
      [12, 12, 12, 0.7],
    ],
    [],
    [[8, 9, 10, 0.55]],
    [],
  ],
  b2: [
    [
      [4, 16, 3, 0.65],
      [8, 14, 3, 0.55],
      [12, 9, 10, 0.6],
    ],
    [],
    [],
    [],
  ],
  b3: [
    [[12, 16, 4, 0.6]],
    [
      [0, 14, 4, 0.55],
      [4, 12, 10, 0.6],
    ],
    [],
    [],
  ],
  b4: [
    [
      [8, 9, 3, 0.55],
      [12, 12, 3, 0.6],
    ],
    [[0, 16, 10, 0.55]],
    [],
    [],
  ],
  rest: silence(4),
};

/** Two high notes over each two-bar chord, swelling in (the rain on the glass); one pair per two bars. */
const PAIRS: readonly (readonly [number, number])[] = [
  [16, 23],
  [16, 21],
  [17, 21],
  [14, 21],
  [16, 23],
  [16, 21],
  [16, 21],
  [14, 21],
];

function pairBars(pairs: readonly (readonly [number, number])[]): Bar[] {
  return pairs.flatMap(([a, b]) => {
    const notes: NoteData[] = [
      [0, a, 28, 0.5],
      [2, b, 26, 0.4],
    ];
    return [notes, []];
  });
}

export const RAIN = lofiSong({
  name: 'rain',
  bpm: 72,
  swing: 0.58,
  humanize: { timeSec: 0.014, velocity: 0.1 },
  gain: 1.15,
  chords: CHORDS,
  voicing: { low: -8, high: 14, center: 4 },
  keys: {
    gain: 0.1,
    rootLow: -20,
    patterns: [
      [[0, 14, 0.75, true]],
      [
        [0, 8, 0.75, true],
        [11, 5, 0.45],
      ],
    ],
  },
  bass: {
    gain: 0.1,
    low: -24,
    patterns: [
      [[0, 'root', 14, 0.85]],
      [
        [0, 'root', 8, 0.85],
        [10, 'fifth', 6, 0.55],
      ],
    ],
  },
  kick: {
    gain: 0.17,
    patterns: [
      [
        [0, 1],
        [11, 0.6],
      ],
      [[0, 1]],
    ],
    fill: [[0, 0.7]],
  },
  hat: {
    gain: 0.05,
    patterns: [
      [
        [2, 0.5],
        [6, 0.45],
        [10, 0.5],
        [14, 0.4],
      ],
      [
        [0, 0.4],
        [2, 0.5],
        [6, 0.45],
        [8, 0.35],
        [10, 0.5],
        [14, 0.4],
      ],
    ],
    fill: [],
  },
  snare: {
    gain: 0.24,
    patterns: [
      [
        [4, 0.9],
        [12, 0.9],
      ],
      [
        [4, 0.9],
        [12, 0.9],
        [15, 0.18],
      ],
    ],
    fill: [],
    late: { chance: 0.45, sec: 0.025 },
  },
  melody: {
    instrument: 'ep',
    gain: 0.16,
    phrases: MELODY,
    form: [
      ['b1', 'rest'],
      ['b2', 'rest'],
      ['b3', 'b1'],
      ['b4', 'rest'],
    ],
  },
  second: {
    instrument: 'epSwell',
    role: 'keys',
    harmony: 'chord',
    gain: 0.06,
    phrases: { pairs: pairBars(PAIRS) },
    form: ['pairs'],
  },
  restChance: 0.35,
  fillChance: 0.3,
});

import { arpeggio, chord, hits, repeat, together } from './note-tools';
import type { Bar, Song } from './song';

/**
 * Variant A, "Шкатулка" (music box): a lullaby on a music box comb, 4/4 at 84 bpm, eighth-note
 * steps, 16 bars (about 46 s). Harmony C | Am | F | G, the melody only on the C major pentatonic.
 * Pitches are semitones from C4: 12 = C5, 16 = E5, 19 = G5, 21 = A5, 24 = C6.
 *
 * Layers: 1 the comb (melody with its own low notes, complete on its own for the menu),
 * 2 soft bass, 3 celesta arpeggio, 4 warm pad, 5 clock tick, 6 high descant bells.
 */

/** Low notes of the comb on beats 1 and 3, per chord (pentatonic, so the F bar is implied by A and C). */
const LOW: Record<'C' | 'Am' | 'F' | 'G' | 'FG', Bar> = {
  C: [
    [0, 0, 4, 0.45],
    [4, -5, 4, 0.4],
  ],
  Am: [
    [0, -3, 4, 0.45],
    [4, 4, 4, 0.4],
  ],
  F: [
    [0, -3, 4, 0.45],
    [4, 0, 4, 0.4],
  ],
  G: [
    [0, -5, 4, 0.45],
    [4, 2, 4, 0.4],
  ],
  FG: [
    [0, -3, 4, 0.45],
    [4, -5, 4, 0.4],
  ],
};

const HOOK: Bar = [
  [0, 16, 2],
  [2, 19, 2],
  [4, 21, 1, 0.8],
  [5, 19, 1, 0.75],
  [6, 16, 2, 0.85],
];
const ANSWER: Bar = [
  [0, 12, 3],
  [3, 14, 1, 0.75],
  [4, 16, 4, 0.9],
];

/** C5, then E5 G5 leading into the A5 that opens B. */
const PICKUP_TO_B: Bar = [
  [0, 12, 5, 0.9],
  [6, 16, 1, 0.55],
  [7, 19, 1, 0.65],
];

const comb = {
  A: [
    together(HOOK, LOW.C),
    together(ANSWER, LOW.Am),
    together(
      [
        [0, 21, 3],
        [3, 19, 1, 0.75],
        [4, 16, 2, 0.85],
        [6, 19, 2, 0.8],
      ],
      LOW.F,
    ),
    together([[0, 14, 6, 0.9]], LOW.G),
  ],
  A2: [
    together(HOOK, LOW.C),
    together(
      [
        [0, 24, 2],
        [2, 21, 2, 0.85],
        [4, 19, 2, 0.85],
        [6, 16, 2, 0.8],
      ],
      LOW.Am,
    ),
    together(
      [
        [0, 21, 2],
        [2, 19, 2, 0.8],
        [4, 14, 2, 0.85],
        [6, 16, 2, 0.8],
      ],
      LOW.FG,
    ),
    together(PICKUP_TO_B, LOW.C),
  ],
  A2b: [
    together(HOOK, LOW.C),
    together(
      [
        [0, 16, 2],
        [2, 21, 2, 0.85],
        [4, 24, 4, 0.9],
      ],
      LOW.Am,
    ),
    together(
      [
        [0, 21, 3],
        [3, 19, 1, 0.75],
        [4, 14, 2, 0.85],
        [6, 16, 2, 0.8],
      ],
      LOW.FG,
    ),
    together(PICKUP_TO_B, LOW.C),
  ],
  B: [
    together(
      [
        [0, 21, 2],
        [2, 24, 2, 0.9],
        [4, 21, 2, 0.8],
        [6, 16, 2, 0.8],
      ],
      LOW.Am,
    ),
    together(
      [
        [0, 19, 3],
        [3, 16, 1, 0.75],
        [4, 19, 2, 0.85],
        [6, 24, 2, 0.9],
      ],
      LOW.C,
    ),
    together(
      [
        [0, 21, 4],
        [4, 19, 1, 0.75],
        [5, 21, 1, 0.8],
        [6, 19, 2, 0.8],
      ],
      LOW.F,
    ),
    together(
      [
        [0, 14, 2, 0.9],
        [2, 16, 2, 0.85],
        [4, 19, 4, 0.9],
      ],
      LOW.G,
    ),
  ],
  B2: [
    together(
      [
        [0, 28, 2, 0.9],
        [2, 24, 2, 0.85],
        [4, 21, 3, 0.85],
        [7, 19, 1, 0.7],
      ],
      LOW.Am,
    ),
    together(
      [
        [0, 16, 2],
        [2, 19, 2, 0.85],
        [4, 24, 4, 0.9],
      ],
      LOW.C,
    ),
    together(
      [
        [0, 21, 2],
        [2, 19, 2, 0.8],
        [4, 16, 2, 0.8],
        [6, 12, 2, 0.8],
      ],
      LOW.F,
    ),
    together(
      [
        [0, 14, 4, 0.9],
        [4, 14, 1, 0.7],
        [5, 16, 1, 0.75],
        [6, 19, 2, 0.85],
      ],
      LOW.G,
    ),
  ],
  A3: [
    together(HOOK, LOW.C),
    together(ANSWER, LOW.Am),
    together(
      [
        [0, 21, 2],
        [2, 19, 2, 0.8],
        [4, 16, 2, 0.8],
        [6, 14, 2, 0.8],
      ],
      LOW.FG,
    ),
    together(
      [
        [0, 12, 5, 0.9],
        [6, 12, 1, 0.55],
        [7, 14, 1, 0.65],
      ],
      LOW.C,
    ),
  ],
};

/** The comb's flourish at the end of some loops: C5 then a pentatonic run up to C6. */
const COMB_FILL: Bar = together(
  [
    [0, 12, 2, 0.9],
    [2, 14, 1, 0.6],
    [3, 16, 1, 0.65],
    [4, 19, 1, 0.7],
    [5, 21, 1, 0.75],
    [6, 24, 2, 0.85],
  ],
  LOW.C,
);

/** Bass roots and fifths in half notes: C3, A2, F2, G2. */
const BASS: Record<'C' | 'Am' | 'F' | 'G' | 'FG', Bar> = {
  C: [
    [0, -12, 4],
    [4, -17, 4, 0.8],
  ],
  Am: [
    [0, -15, 4],
    [4, -8, 4, 0.8],
  ],
  F: [
    [0, -19, 4],
    [4, -12, 4, 0.8],
  ],
  G: [
    [0, -17, 4],
    [4, -10, 4, 0.8],
  ],
  FG: [
    [0, -19, 4],
    [4, -17, 4, 0.85],
  ],
};

/** Chord tones of the arpeggio (pentatonic only), low to high. */
const ARP_TONES = {
  C: [0, 4, 7, 12],
  Am: [-3, 0, 4, 9],
  F: [-3, 0, 9, 12],
  G: [-5, 2, 7, 14],
} as const;
const ARP_VEL = [0.9, 0.5, 0.7, 0.5, 0.8, 0.5, 0.7, 0.5];

function arpBar(tones: readonly number[]): Bar {
  return arpeggio(tones, {
    every: 1,
    count: 8,
    length: 2,
    order: [0, 1, 2, 3, 2, 1, 2, 1],
    velocities: ARP_VEL,
  });
}

function arpSplit(first: readonly number[], second: readonly number[]): Bar {
  const half = { every: 1, count: 4, length: 2, order: [0, 1, 2, 3], velocities: ARP_VEL };
  return [...arpeggio(first, half), ...arpeggio(second, { ...half, start: 4 })];
}

const ARP = {
  C: arpBar(ARP_TONES.C),
  Am: arpBar(ARP_TONES.Am),
  F: arpBar(ARP_TONES.F),
  G: arpBar(ARP_TONES.G),
  FG: arpSplit(ARP_TONES.F, ARP_TONES.G),
};

/** Pad dyads, a whole bar each (the F bar is A3 and C4 over the F of the bass). */
const PAD = {
  C: chord([4, 7], 0, 8),
  Am: chord([0, 4], 0, 8),
  F: chord([-3, 0], 0, 8),
  G: chord([2, 7], 0, 8),
  FG: [...chord([-3, 0], 0, 4), ...chord([2, 7], 4, 4)],
};

const TICK: Bar = hits([
  [0, 0.9],
  [2, 0.5],
  [4, 0.75],
  [6, 0.5],
]);
const TICK_FILL: Bar = hits([
  [0, 0.9],
  [2, 0.5],
  [4, 0.6],
  [5, 0.6],
  [6, 0.7],
  [7, 0.8],
]);

const DESCANT = {
  A: [
    [[4, 28, 4, 0.7]],
    [[4, 24, 4, 0.6]],
    [
      [4, 24, 2, 0.6],
      [6, 21, 2, 0.5],
    ],
    [[2, 26, 6, 0.7]],
  ],
  A2: [
    [[4, 31, 4, 0.55]],
    [[4, 28, 4, 0.6]],
    [
      [2, 24, 2, 0.6],
      [6, 26, 2, 0.6],
    ],
    [[2, 28, 6, 0.65]],
  ],
  B: [[[6, 28, 2, 0.5]], [[4, 31, 4, 0.5]], [[4, 24, 4, 0.6]], [[4, 26, 4, 0.6]]],
  A3: [
    [[4, 28, 4, 0.7]],
    [[4, 24, 4, 0.6]],
    [
      [2, 24, 2, 0.6],
      [6, 26, 2, 0.6],
    ],
    [[2, 24, 6, 0.6]],
  ],
} satisfies Record<string, Bar[]>;

export const BOX: Song = {
  name: 'box',
  bpm: 84,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  bars: 16,
  gain: 1,
  restChance: 0.35,
  fillChance: 0.5,
  parts: [
    {
      id: 'comb',
      instrument: 'musicBox',
      layer: 1,
      gain: 0.3,
      scale: 'penta',
      phrases: comb,
      form: ['A', ['A2', 'A2b'], ['B', 'B2'], 'A3'],
      restBars: [3, 11],
      fill: COMB_FILL,
    },
    {
      id: 'bass',
      instrument: 'softBass',
      layer: 2,
      gain: 0.3,
      scale: 'pentaF',
      phrases: {
        A: [BASS.C, BASS.Am, BASS.F, BASS.G],
        A2: [BASS.C, BASS.Am, BASS.FG, BASS.C],
        B: [BASS.Am, BASS.C, BASS.F, BASS.G],
      },
      form: ['A', 'A2', 'B', 'A2'],
    },
    {
      id: 'arp',
      instrument: 'celesta',
      layer: 3,
      gain: 0.16,
      scale: 'penta',
      phrases: {
        A: [ARP.C, ARP.Am, ARP.F, ARP.G],
        A2: [ARP.C, ARP.Am, ARP.FG, ARP.C],
        B: [ARP.Am, ARP.C, ARP.F, ARP.G],
      },
      form: ['A', 'A2', 'B', 'A2'],
      restBars: [7, 13],
    },
    {
      id: 'pad',
      instrument: 'warmPad',
      layer: 4,
      gain: 0.05,
      scale: 'penta',
      phrases: {
        A: [PAD.C, PAD.Am, PAD.F, PAD.G],
        A2: [PAD.C, PAD.Am, PAD.FG, PAD.C],
        B: [PAD.Am, PAD.C, PAD.F, PAD.G],
      },
      form: ['A', 'A2', 'B', 'A2'],
    },
    {
      id: 'tick',
      instrument: 'tick',
      layer: 5,
      gain: 0.3,
      scale: 'unpitched',
      phrases: { T: repeat(4, TICK) },
      form: ['T', 'T', 'T', 'T'],
      fill: TICK_FILL,
    },
    {
      id: 'descant',
      instrument: 'musicBox',
      layer: 6,
      gain: 0.19,
      scale: 'penta',
      phrases: DESCANT,
      form: ['A', 'A2', 'B', 'A3'],
      restBars: [5, 9],
    },
  ],
};

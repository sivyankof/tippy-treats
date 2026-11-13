import type { Rarity } from './rarity';

/**
 * Sound recipes from section 7 of docs/06-art-animation-audio.md.
 * Frequencies are Hz, times are seconds, gains are linear (0..1) before the master gain.
 */

/** Concert pitch C5 in Hz: the root of the combo ladder and of the record fanfare. */
const C5_HZ = 523.25;

export type SynthWave = 'sine' | 'triangle' | 'square' | 'sawtooth';

/** One oscillator note with an attack ramp and an exponential decay over `duration`. */
export interface ToneRecipe {
  wave: SynthWave;
  freq: number;
  /** When set, the pitch glides exponentially from `freq` to this value over `duration`. */
  endFreq?: number;
  attack: number;
  duration: number;
  gain: number;
}

/** A burst of filtered noise. */
export interface NoiseRecipe {
  filter: 'lowpass' | 'highpass' | 'bandpass';
  cutoff: number;
  /** When set, the cutoff glides exponentially to this value over `duration`. */
  endCutoff?: number;
  q: number;
  attack: number;
  duration: number;
  gain: number;
}

/** A tone with a start offset, used by multi-note sounds. */
export interface TimedTone extends ToneRecipe {
  delay: number;
}

/** A noise burst with a start offset. */
export interface TimedNoise extends NoiseRecipe {
  delay: number;
}

/** Ability sound: a short note sequence per rarity. */
export interface AbilityRecipe {
  notes: readonly TimedTone[];
}

export const SFX = {
  /** Gain floor: exponential ramps never go to 0, they end here and the node is stopped. */
  silence: 0.0001,
  /** Extra time an oscillator runs past its decay before it is stopped. */
  stopTail: 0.03,
  master: {
    gain: 0.7,
    /** Gentle limiter so stacked sounds do not clip. */
    compressor: { threshold: -18, knee: 20, ratio: 4, attack: 0.003, release: 0.2 },
  },
  noise: {
    /** Length of the shared noise buffer; no noise burst may be longer. */
    bufferSeconds: 0.5,
  },
  semitonesPerOctave: 12,

  /** "Обычный бросок": soft low slap, pitch randomly +-5%. */
  drop: {
    pitchJitter: 0.05,
    thump: {
      wave: 'sine',
      freq: 170,
      endFreq: 70,
      attack: 0.004,
      duration: 0.14,
      gain: 0.55,
    } satisfies ToneRecipe,
    slap: {
      filter: 'lowpass',
      cutoff: 700,
      endCutoff: 250,
      q: 0.7,
      attack: 0.002,
      duration: 0.06,
      gain: 0.22,
    } satisfies NoiseRecipe,
  },

  /** "Идеальный бросок": a clean bell; the pitch climbs the pentatonic ladder with the combo. */
  perfect: {
    rootFreq: C5_HZ,
    /** Major pentatonic C D E G A, then the same an octave higher (offsets in semitones). */
    ladderSemitones: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26],
    /** Bell partials: frequency ratio, gain share and decay share of the note length. */
    partials: [
      { ratio: 1, gain: 0.5, decay: 1 },
      { ratio: 2, gain: 0.2, decay: 0.7 },
      { ratio: 3.01, gain: 0.1, decay: 0.45 },
      { ratio: 4.2, gain: 0.06, decay: 0.3 },
    ],
    attack: 0.003,
    duration: 0.7,
    /** Each combo step makes the bell a little louder, up to `maxGainScale`. */
    gainPerStep: 0.07,
    maxGainScale: 1.5,
  },

  /** "Откусывание": a crunch, short filtered noise (two quick bursts). */
  bite: {
    bursts: [
      {
        delay: 0,
        filter: 'bandpass',
        cutoff: 2200,
        endCutoff: 1200,
        q: 1.4,
        attack: 0.002,
        duration: 0.07,
        gain: 0.5,
      },
      {
        delay: 0.055,
        filter: 'bandpass',
        cutoff: 1700,
        endCutoff: 900,
        q: 1.2,
        attack: 0.002,
        duration: 0.08,
        gain: 0.4,
      },
    ] satisfies readonly TimedNoise[],
  },

  /** "Монета": a double high ding. */
  coin: {
    notes: [
      { delay: 0, wave: 'triangle', freq: 1760, attack: 0.002, duration: 0.18, gain: 0.3 },
      { delay: 0.075, wave: 'triangle', freq: 2349, attack: 0.002, duration: 0.3, gain: 0.3 },
    ] satisfies readonly TimedTone[],
  },

  /** "Ягода": a chord of three notes (D major triad). */
  berry: {
    wave: 'sine',
    freqs: [587.33, 739.99, 880],
    stagger: 0.03,
    attack: 0.01,
    duration: 0.45,
    gain: 0.28,
  },

  /** "Способность": own short sound per rarity plus a shared puff. */
  ability: {
    puff: {
      filter: 'lowpass',
      cutoff: 1400,
      endCutoff: 300,
      q: 0.5,
      attack: 0.01,
      duration: 0.18,
      gain: 0.3,
    } satisfies NoiseRecipe,
    byRarity: {
      common: {
        notes: [
          { delay: 0.04, wave: 'triangle', freq: 660, attack: 0.005, duration: 0.18, gain: 0.3 },
        ],
      },
      rare: {
        notes: [
          { delay: 0.04, wave: 'triangle', freq: 660, attack: 0.005, duration: 0.15, gain: 0.3 },
          { delay: 0.12, wave: 'triangle', freq: 880, attack: 0.005, duration: 0.2, gain: 0.3 },
        ],
      },
      epic: {
        notes: [
          { delay: 0.04, wave: 'triangle', freq: 660, attack: 0.005, duration: 0.14, gain: 0.3 },
          { delay: 0.11, wave: 'triangle', freq: 830, attack: 0.005, duration: 0.14, gain: 0.3 },
          { delay: 0.18, wave: 'triangle', freq: 990, attack: 0.005, duration: 0.26, gain: 0.32 },
        ],
      },
      legendary: {
        notes: [
          { delay: 0.04, wave: 'triangle', freq: 660, attack: 0.005, duration: 0.14, gain: 0.3 },
          { delay: 0.1, wave: 'triangle', freq: 830, attack: 0.005, duration: 0.14, gain: 0.3 },
          { delay: 0.16, wave: 'triangle', freq: 990, attack: 0.005, duration: 0.14, gain: 0.32 },
          { delay: 0.22, wave: 'sine', freq: 1320, attack: 0.005, duration: 0.5, gain: 0.36 },
          { delay: 0.22, wave: 'sine', freq: 1980, attack: 0.005, duration: 0.4, gain: 0.14 },
        ],
      },
    } satisfies Record<Rarity, AbilityRecipe>,
  },

  /** "Чих": a comic squeak sliding down. */
  sneeze: {
    squeak: {
      wave: 'triangle',
      freq: 1500,
      endFreq: 380,
      attack: 0.01,
      duration: 0.26,
      gain: 0.35,
    } satisfies ToneRecipe,
    puff: {
      delay: 0.2,
      filter: 'lowpass',
      cutoff: 1800,
      endCutoff: 400,
      q: 0.5,
      attack: 0.005,
      duration: 0.1,
      gain: 0.25,
    } satisfies TimedNoise,
  },

  /** "Промах": a falling whistle, then a boom. */
  miss: {
    whistle: {
      wave: 'sine',
      freq: 1100,
      endFreq: 160,
      attack: 0.01,
      duration: 0.45,
      gain: 0.3,
    } satisfies ToneRecipe,
    boomDelay: 0.42,
    boom: {
      wave: 'sine',
      freq: 110,
      endFreq: 38,
      attack: 0.005,
      duration: 0.5,
      gain: 0.8,
    } satisfies ToneRecipe,
    boomNoise: {
      filter: 'lowpass',
      cutoff: 400,
      endCutoff: 100,
      q: 0.7,
      attack: 0.003,
      duration: 0.3,
      gain: 0.4,
    } satisfies NoiseRecipe,
  },

  /** "Рассыпание башни": a series of slaps with falling volume, throttled. */
  collapse: {
    thud: {
      wave: 'sine',
      freq: 150,
      endFreq: 60,
      attack: 0.003,
      duration: 0.1,
      gain: 0.5,
    } satisfies ToneRecipe,
    pitchJitter: 0.1,
    /** Each next slap in the series is this share of the previous one. */
    gainFalloff: 0.9,
    /** Slaps never get quieter than this share. */
    gainFloor: 0.12,
    /** Calls closer than this to the previous slap are dropped, so a 100-layer fall stays a rumble. */
    minIntervalSec: 0.045,
  },

  /** "Рекорд": a fanfare of 5 notes. */
  record: {
    rootFreq: C5_HZ,
    semitones: [0, 4, 7, 12, 16],
    spacing: 0.11,
    wave: 'triangle',
    attack: 0.005,
    duration: 0.22,
    /** The last note rings longer. */
    finalDuration: 0.7,
    gain: 0.32,
  },

  /** "Кнопки": a short click. */
  click: {
    wave: 'triangle',
    freq: 1300,
    endFreq: 800,
    attack: 0.001,
    duration: 0.035,
    gain: 0.3,
  } satisfies ToneRecipe,

  /** "Существо на главном экране": a squeak; `pitch` scales it per creature. */
  squeak: {
    wave: 'sine',
    freq: 900,
    endFreq: 1300,
    attack: 0.008,
    duration: 0.16,
    gain: 0.35,
  } satisfies ToneRecipe,
} as const;

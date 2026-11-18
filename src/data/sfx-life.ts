import type { NoiseRecipe, TimedNoise, TimedTone, ToneRecipe } from './sfx';
import type { SquashKind } from './topper-squash';

/**
 * Sounds of the things added in sessions 3 to 5e (docs/06, section 7): cuts, squashed toppers,
 * weather, yawns, zone changes, the countdown, purchases. Frequencies are Hz, times seconds, gains
 * linear before the master. Tonal sounds keep to the C major pentatonic (C D E G A) so they never
 * clash with the music.
 */

/** C major pentatonic notes used by the tonal sounds below, Hz. */
const NOTE = {
  e5: 659.25,
  g5: 783.99,
  a5: 880,
  c6: 1046.5,
  d6: 1174.66,
  e6: 1318.51,
  g6: 1567.98,
  c5: 523.25,
} as const;

/** A random range `[min, max]` the sound draws from through the synth's random. */
export type Span = readonly [min: number, max: number];

/** One squashed-topper sound: tones and noise bursts, with an overall pitch and loudness multiplier. */
export interface SquashRecipe {
  tones: readonly TimedTone[];
  noises: readonly TimedNoise[];
  pitch: number;
  gain: number;
}

/** The wet "чвак" of a berry: a low pop and a wet burst of noise. Cherry and strawberry share it. */
const JUICY: Pick<SquashRecipe, 'tones' | 'noises'> = {
  tones: [
    { delay: 0, wave: 'sine', freq: 340, endFreq: 105, attack: 0.003, duration: 0.09, gain: 0.3 },
    {
      delay: 0.045,
      wave: 'sine',
      freq: 190,
      endFreq: 90,
      attack: 0.003,
      duration: 0.07,
      gain: 0.14,
    },
  ],
  noises: [
    {
      delay: 0,
      filter: 'bandpass',
      cutoff: 1500,
      endCutoff: 450,
      q: 1.1,
      attack: 0.003,
      duration: 0.12,
      gain: 0.34,
    },
  ],
};

export const SFX_LIFE = {
  /** Cut with strands. */
  cut: {
    /** The strands start to pull: a short stretchy rising note over a soft wet hiss. */
    stretch: {
      tone: {
        wave: 'sine',
        freq: 190,
        endFreq: 470,
        attack: 0.05,
        duration: 0.26,
        gain: 0.14,
      } satisfies ToneRecipe,
      wet: {
        filter: 'bandpass',
        cutoff: 600,
        endCutoff: 1500,
        q: 1.4,
        attack: 0.05,
        duration: 0.28,
        gain: 0.09,
      } satisfies NoiseRecipe,
    },
    /** One strand snaps: a small tick and a click; the pitch of each is a little different. */
    snap: {
      pitchJitter: 0.18,
      tick: {
        wave: 'triangle',
        freq: 1500,
        endFreq: 700,
        attack: 0.002,
        duration: 0.045,
        gain: 0.27,
      } satisfies ToneRecipe,
      click: {
        filter: 'highpass',
        cutoff: 3000,
        q: 0.8,
        attack: 0.001,
        duration: 0.02,
        gain: 0.16,
      } satisfies NoiseRecipe,
    },
    /** The drop of glaze falls: a "кап" a little after the snap. */
    drip: {
      delay: 0.1,
      wave: 'sine',
      freq: 1150,
      endFreq: 600,
      attack: 0.002,
      duration: 0.075,
      gain: 0.2,
    } satisfies TimedTone,
    /** The panicking piece: a short comic squeak sliding down, quieter than the sneeze, and a smaller second one. */
    panic: [
      {
        delay: 0,
        wave: 'triangle',
        freq: 1750,
        endFreq: 650,
        attack: 0.008,
        duration: 0.2,
        gain: 0.2,
      },
      {
        delay: 0.17,
        wave: 'triangle',
        freq: 1400,
        endFreq: 560,
        attack: 0.006,
        duration: 0.11,
        gain: 0.12,
      },
    ] satisfies readonly TimedTone[],
  },

  /** Squashed toppers, one sound per kind. The cream one is the roller's quiet squeeze. */
  squash: {
    cherry: { ...JUICY, pitch: 1, gain: 1 },
    strawberry: { ...JUICY, pitch: 1.18, gain: 0.9 },
    /** "Пшик": a fizzy spray of high noise with a faint high fizz. */
    lemon: {
      tones: [
        {
          delay: 0.01,
          wave: 'sine',
          freq: 2400,
          endFreq: 3300,
          attack: 0.01,
          duration: 0.09,
          gain: 0.05,
        },
      ],
      noises: [
        {
          delay: 0,
          filter: 'highpass',
          cutoff: 3200,
          endCutoff: 6500,
          q: 0.7,
          attack: 0.012,
          duration: 0.2,
          gain: 0.24,
        },
      ],
      pitch: 1,
      gain: 1,
    },
    /** A soft leaf crunch: two quiet bandpass bursts. */
    mint: {
      tones: [],
      noises: [
        {
          delay: 0,
          filter: 'bandpass',
          cutoff: 3200,
          endCutoff: 2200,
          q: 1,
          attack: 0.004,
          duration: 0.06,
          gain: 0.2,
        },
        {
          delay: 0.05,
          filter: 'bandpass',
          cutoff: 2800,
          endCutoff: 1900,
          q: 1,
          attack: 0.004,
          duration: 0.07,
          gain: 0.15,
        },
      ],
      pitch: 1,
      gain: 2,
    },
    /** A dry crunch: three sharp narrow bursts. */
    wafer: {
      tones: [],
      noises: [
        {
          delay: 0,
          filter: 'bandpass',
          cutoff: 2700,
          endCutoff: 1500,
          q: 2.2,
          attack: 0.002,
          duration: 0.035,
          gain: 0.36,
        },
        {
          delay: 0.035,
          filter: 'bandpass',
          cutoff: 2300,
          endCutoff: 1300,
          q: 2.2,
          attack: 0.002,
          duration: 0.04,
          gain: 0.3,
        },
        {
          delay: 0.078,
          filter: 'bandpass',
          cutoff: 2000,
          endCutoff: 1100,
          q: 2,
          attack: 0.002,
          duration: 0.05,
          gain: 0.24,
        },
      ],
      pitch: 1,
      gain: 1.9,
    },
    /** The wet "пффт" of cream squeezed by the roller: quiet, slow and longer. */
    cream: {
      tones: [
        {
          delay: 0.02,
          wave: 'sine',
          freq: 150,
          endFreq: 95,
          attack: 0.05,
          duration: 0.24,
          gain: 0.07,
        },
      ],
      noises: [
        {
          delay: 0,
          filter: 'bandpass',
          cutoff: 420,
          endCutoff: 1300,
          q: 1.2,
          attack: 0.06,
          duration: 0.3,
          gain: 0.13,
        },
      ],
      pitch: 1,
      gain: 1,
    },
  } satisfies Record<SquashKind, SquashRecipe>,

  /** The juice stain is licked: the short slurp, shorter and quieter. */
  juiceSlurp: { timeShare: 0.62, gainShare: 0.6 },

  /** The puff of snow dust when a layer lands on a snow cap. */
  snowPuff: {
    wet: {
      filter: 'lowpass',
      cutoff: 1500,
      endCutoff: 450,
      q: 0.5,
      attack: 0.025,
      duration: 0.16,
      gain: 0.3,
    } satisfies NoiseRecipe,
  },

  /**
   * Thunder after a flash: a short crack, then a low roll `rollSeconds` long made of overlapping
   * noise stretches (one noise buffer is only half a second) and a falling low note. It starts
   * `delay` seconds after the flash. Behind glass it is `muffled`: lower, quieter.
   */
  thunder: {
    delay: [0.15, 0.4] as Span,
    rollSeconds: [0.8, 1.2] as Span,
    crack: {
      filter: 'lowpass',
      cutoff: 1400,
      endCutoff: 260,
      q: 0.8,
      attack: 0.004,
      duration: 0.14,
      gain: 0.26,
    } satisfies NoiseRecipe,
    rumble: {
      filter: 'lowpass',
      cutoff: 220,
      endCutoff: 70,
      q: 0.7,
      attack: 0.12,
      duration: 0.46,
      gain: 0.4,
    } satisfies NoiseRecipe,
    /** The stretches of the roll start this far apart, each a little quieter. */
    rumbleStep: 0.34,
    rumbleFalloff: 0.8,
    low: {
      wave: 'sine',
      freq: 62,
      endFreq: 36,
      attack: 0.1,
      duration: 1,
      gain: 0.32,
    } satisfies ToneRecipe,
    muffled: { pitch: 0.55, gain: 0.55 },
  },

  /** The layers startle at a lightning flash: one short common "ой" per wave (weak behind glass). */
  startle: {
    notes: [
      {
        delay: 0,
        wave: 'triangle',
        freq: 640,
        endFreq: 960,
        attack: 0.006,
        duration: 0.07,
        gain: 0.2,
      },
      {
        delay: 0.07,
        wave: 'triangle',
        freq: 980,
        endFreq: 700,
        attack: 0.006,
        duration: 0.1,
        gain: 0.2,
      },
    ] satisfies readonly TimedTone[],
    weakGain: 0.55,
  },

  /** A sleepy layer yawns: a slow quiet note that climbs and sags, with a breath of noise. */
  yawn: {
    notes: [
      { delay: 0, wave: 'sine', freq: 250, endFreq: 420, attack: 0.16, duration: 0.36, gain: 0.1 },
      {
        delay: 0.3,
        wave: 'sine',
        freq: 420,
        endFreq: 190,
        attack: 0.05,
        duration: 0.44,
        gain: 0.1,
      },
      {
        delay: 0,
        wave: 'triangle',
        freq: 500,
        endFreq: 380,
        attack: 0.2,
        duration: 0.7,
        gain: 0.025,
      },
    ] satisfies readonly TimedTone[],
    breath: {
      delay: 0.05,
      filter: 'bandpass',
      cutoff: 900,
      endCutoff: 500,
      q: 0.6,
      attack: 0.18,
      duration: 0.5,
      gain: 0.04,
    } satisfies TimedNoise,
  },

  /** A new zone: a soft airy sweep and three rising pentatonic notes. */
  zone: {
    sweep: {
      filter: 'bandpass',
      cutoff: 400,
      endCutoff: 2200,
      q: 0.9,
      attack: 0.06,
      duration: 0.34,
      gain: 0.07,
    } satisfies NoiseRecipe,
    notes: [
      { delay: 0.04, wave: 'sine', freq: NOTE.c5, attack: 0.01, duration: 0.2, gain: 0.2 },
      { delay: 0.14, wave: 'sine', freq: NOTE.e5, attack: 0.01, duration: 0.2, gain: 0.2 },
      { delay: 0.24, wave: 'sine', freq: NOTE.g5, attack: 0.01, duration: 0.5, gain: 0.22 },
    ] satisfies readonly TimedTone[],
  },

  /** A new lap of Space: four quick notes up the ladder to a high ringing one. */
  lap: {
    notes: [
      { delay: 0, wave: 'sine', freq: NOTE.g5, attack: 0.006, duration: 0.12, gain: 0.18 },
      { delay: 0.08, wave: 'sine', freq: NOTE.c6, attack: 0.006, duration: 0.12, gain: 0.18 },
      { delay: 0.16, wave: 'sine', freq: NOTE.e6, attack: 0.006, duration: 0.14, gain: 0.18 },
      { delay: 0.24, wave: 'sine', freq: NOTE.g6, attack: 0.006, duration: 0.55, gain: 0.2 },
      { delay: 0.24, wave: 'sine', freq: NOTE.g6 * 2, attack: 0.006, duration: 0.35, gain: 0.05 },
    ] satisfies readonly TimedTone[],
  },

  /** The tick of the "Continue?" countdown; the last two seconds are higher and a bit louder. */
  tick: {
    calm: {
      wave: 'sine',
      freq: NOTE.e5,
      attack: 0.002,
      duration: 0.05,
      gain: 0.14,
    } satisfies ToneRecipe,
    urgent: {
      wave: 'sine',
      freq: NOTE.c6,
      attack: 0.002,
      duration: 0.05,
      gain: 0.18,
    } satisfies ToneRecipe,
  },

  /** A purchase went through: the coin ding, then the berry chord. */
  purchase: { berryDelay: 0.16, berryGain: 0.8 },

  /** The weather beds (owner's choice, off by default): see `data/weather-bed.ts`. */
} as const;

/** Every note the tonal sounds use, for the test that keeps them on the pentatonic. */
export const LIFE_NOTES: readonly number[] = Object.values(NOTE);

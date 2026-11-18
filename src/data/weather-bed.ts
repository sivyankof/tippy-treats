import type { WeatherId } from './weather';

/** The weather beds: a quiet looped filtered noise under the run (rain, a storm, wind of the snow). */
export type BedKind = 'rain' | 'storm' | 'wind';

/** One bed: a looped noise through a filter, its level swelling slowly (no beat) by a slow oscillator. */
export interface BedRecipe {
  filter: 'lowpass' | 'highpass' | 'bandpass';
  cutoff: number;
  q: number;
  /** Level of the bed (linear, before the sfx bus). */
  gain: number;
  /** The slow swell: `rateHz` is its speed, `depth` its share of `gain` (0..1). */
  swell: { rateHz: number; depth: number };
  fadeInSec: number;
  fadeOutSec: number;
}

export const WEATHER_BED = {
  /**
   * Off in the game by default: the owner decides whether the beds are wanted (they can be heard on
   * the soundboard, `?soundboard=1`). Even when on, the minimal effects level never plays a bed.
   */
  enabled: false,
  /** Seconds of the noise a bed loops: long enough that the loop is not heard as a pattern. */
  bufferSeconds: 4,
  /** How long the soundboard and the offline render play a bed, seconds. */
  previewSeconds: 6,
  /** The noise stops this long after its fade, seconds. */
  stopTail: 0.05,
  /** Which bed goes with which weather; the others have none. */
  byWeather: { rain: 'rain', storm: 'storm', snow: 'wind' } as Partial<Record<WeatherId, BedKind>>,
  beds: {
    rain: {
      filter: 'bandpass',
      cutoff: 3200,
      q: 0.35,
      gain: 0.045,
      swell: { rateHz: 0.11, depth: 0.25 },
      fadeInSec: 1.2,
      fadeOutSec: 0.8,
    },
    storm: {
      filter: 'bandpass',
      cutoff: 2300,
      q: 0.3,
      gain: 0.065,
      swell: { rateHz: 0.08, depth: 0.35 },
      fadeInSec: 1.2,
      fadeOutSec: 0.8,
    },
    wind: {
      filter: 'bandpass',
      cutoff: 650,
      q: 0.7,
      gain: 0.05,
      swell: { rateHz: 0.1, depth: 0.5 },
      fadeInSec: 1.5,
      fadeOutSec: 1,
    },
  } satisfies Record<BedKind, BedRecipe>,
} as const;

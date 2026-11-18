import { toDb } from '../levels';

/**
 * Measurements of a rendered tune (the acceptance table of the music): the level of a stretch,
 * the step of the loop seam, a DC offset and denormal samples. Pure, over plain sample arrays.
 */

/** Plain RMS of the frames of [from, to) seconds over all channels, dBFS (silence counts). */
export function stretchRmsDb(
  channels: readonly Float32Array[],
  sampleRate: number,
  from: number,
  to: number,
): number {
  const first = Math.max(0, Math.floor(from * sampleRate));
  let sum = 0;
  let counted = 0;
  for (const channel of channels) {
    const last = Math.min(channel.length, Math.floor(to * sampleRate));
    for (let i = first; i < last; i++) {
      const x = channel[i] ?? 0;
      sum += x * x;
      counted += 1;
    }
  }
  return counted === 0 ? -Infinity : toDb(Math.sqrt(sum / counted));
}

/** The seam of a loop at `at` seconds: RMS of the `span` before and after it, and their difference (after - before). */
export function seamDb(
  channels: readonly Float32Array[],
  sampleRate: number,
  at: number,
  span: number,
): { before: number; after: number; diff: number } {
  const before = stretchRmsDb(channels, sampleRate, at - span, at);
  const after = stretchRmsDb(channels, sampleRate, at, at + span);
  return { before, after, diff: after - before };
}

/** Mean sample value over all channels (a DC offset shows here). */
export function dcOffset(channels: readonly Float32Array[]): number {
  let sum = 0;
  let counted = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) sum += channel[i] ?? 0;
    counted += channel.length;
  }
  return counted === 0 ? 0 : sum / counted;
}

/** Smallest normal float32 magnitude: anything non-zero below it is a denormal. */
const FLOAT32_MIN_NORMAL = 1.1754943508222875e-38;

/** Count of non-zero samples below the smallest normal float32 (they slow some CPUs down). */
export function denormalSamples(channels: readonly Float32Array[]): number {
  let n = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const a = Math.abs(channel[i] ?? 0);
      if (a > 0 && a < FLOAT32_MIN_NORMAL) n += 1;
    }
  }
  return n;
}

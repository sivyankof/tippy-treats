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

/** In-place radix-2 FFT of `re` + i`im` (length a power of two). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const a = start + k;
        const b = a + size / 2;
        const br = re[b] ?? 0;
        const bi = im[b] ?? 0;
        const tr = br * wr - bi * wi;
        const ti = br * wi + bi * wr;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
      }
    }
  }
}

/**
 * Share of the energy above `cutoff` Hz (0..1) of the first channel, from the power spectra of
 * Hann-windowed frames of `frame` samples, at most `maxFrames` of them spread over the signal.
 * A soft, dark mix has a small share.
 */
export function energyShareAbove(
  samples: Float32Array,
  sampleRate: number,
  cutoff: number,
  frame = 2048,
  maxFrames = 400,
): number {
  const count = Math.floor(samples.length / frame);
  if (count === 0) return 0;
  const every = Math.max(1, Math.floor(count / maxFrames));
  const firstBin = Math.ceil((cutoff / sampleRate) * frame);
  const re = new Float64Array(frame);
  const im = new Float64Array(frame);
  let above = 0;
  let total = 0;
  for (let f = 0; f < count; f += every) {
    for (let i = 0; i < frame; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
      re[i] = (samples[f * frame + i] ?? 0) * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k <= frame / 2; k++) {
      const power = (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
      total += power;
      if (k >= firstBin) above += power;
    }
  }
  return total === 0 ? 0 : above / total;
}

/**
 * The step between neighbouring samples (all channels): the largest, and the one that only
 * `1 - quantile` of the steps exceed. A click shows as a largest step far above the quantile.
 */
export function sampleSteps(
  channels: readonly Float32Array[],
  quantile = 0.999,
): { max: number; quantile: number } {
  const total = channels.reduce((sum, channel) => sum + Math.max(0, channel.length - 1), 0);
  if (total === 0) return { max: 0, quantile: 0 };
  const steps = new Float32Array(total);
  let n = 0;
  for (const channel of channels) {
    for (let i = 1; i < channel.length; i++) {
      steps[n++] = Math.abs((channel[i] ?? 0) - (channel[i - 1] ?? 0));
    }
  }
  steps.sort();
  const at = Math.min(steps.length - 1, Math.floor(quantile * steps.length));
  return { max: steps[steps.length - 1] ?? 0, quantile: steps[at] ?? 0 };
}

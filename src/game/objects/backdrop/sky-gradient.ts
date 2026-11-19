import type { GradientStop } from '../../../data/backdrop/backdrop-colors';
import { mixColor } from '../../../util/color';

/** Colour of a gradient at `t` (0 top, 1 bottom); stops must be sorted by `at`. */
export function gradientColorAt(stops: readonly GradientStop[], t: number): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (t <= first.at) return first.color;
  if (t >= last.at) return last.color;
  for (let i = 1; i < stops.length; i++) {
    const to = stops[i];
    const from = stops[i - 1];
    if (to && from && t <= to.at) {
      return mixColor(from.color, to.color, (t - from.at) / (to.at - from.at));
    }
  }
  return last.color;
}

/** Colours of `count` equal bands of the gradient, sampled at the middle of each band. */
export function gradientBands(stops: readonly GradientStop[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => gradientColorAt(stops, (i + 0.5) / count));
}

const NOISE_A = 0x9e3779b9;
const NOISE_B = 0x7f4a7c15;
const NOISE_SKEW = 7919;
const NOISE_SKEW_B = 104729;
const UINT32 = 0x100000000;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ NOISE_A, 0x85ebca6b) ^ Math.imul(b + NOISE_B, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / UINT32;
}

/** Light noise in -1..1 (triangular, so it averages out), the same for the same cell. */
export function ditherNoise(x: number, y: number): number {
  return hash(x, y) + hash(y + NOISE_SKEW, x + NOISE_SKEW_B) - 1;
}

/**
 * Fills the rows `from`..`to` (exclusive) of the RGBA pixels `out` of a `width` x `height`
 * picture of the gradient with `levels` of colour noise added before the rounding to 8 bits: the
 * steps of a dark gradient break up into fine grain.
 */
export function fillDitheredRows(
  out: Uint8ClampedArray,
  stops: readonly GradientStop[],
  width: number,
  height: number,
  levels: number,
  from: number,
  to: number,
): void {
  for (let y = from; y < to; y++) {
    const base = gradientColorAt(stops, (y + 0.5) / height);
    const r = (base >> 16) & 0xff;
    const g = (base >> 8) & 0xff;
    const b = base & 0xff;
    for (let x = 0; x < width; x++) {
      const noise = ditherNoise(x, y) * levels;
      const at = (y * width + x) * 4;
      out[at] = r + noise;
      out[at + 1] = g + noise;
      out[at + 2] = b + noise;
      out[at + 3] = 255;
    }
  }
}

/** The whole dithered picture at once (see `fillDitheredRows`). */
export function ditheredSky(
  stops: readonly GradientStop[],
  width: number,
  height: number,
  levels: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  fillDitheredRows(out, stops, width, height, levels, 0, height);
  return out;
}

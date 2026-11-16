import type { GradientStop } from '../../../data/backdrop-colors';
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

/** Light noise in -1..1 (triangular, so it averages out), the same for the same cell. */
export function ditherNoise(x: number, y: number): number {
  const hash = (a: number, b: number): number => {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
  };
  return hash(x, y) + hash(y + 7919, x + 104729) - 1;
}

/**
 * RGBA pixels of a `width` x `height` picture of the gradient with `levels` of colour noise added
 * before the rounding to 8 bits: the steps of a dark gradient break up into fine grain.
 */
export function ditheredSky(
  stops: readonly GradientStop[],
  width: number,
  height: number,
  levels: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const shift = [16, 8, 0] as const;
  for (let y = 0; y < height; y++) {
    const base = gradientColorAt(stops, (y + 0.5) / height);
    for (let x = 0; x < width; x++) {
      const noise = ditherNoise(x, y) * levels;
      const at = (y * width + x) * 4;
      shift.forEach((bits, c) => {
        out[at + c] = ((base >> bits) & 0xff) + noise;
      });
      out[at + 3] = 255;
    }
  }
  return out;
}

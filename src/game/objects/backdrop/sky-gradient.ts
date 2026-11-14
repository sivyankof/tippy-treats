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

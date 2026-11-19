import type { Rng } from './rng';

/** Index of a weighted pick: one draw from `rng`; entries with weight 0 are never chosen. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i] ?? 0;
    if (weight > 0 && roll < weight) return i;
    roll -= weight;
  }
  // Rounding at the very end: the last entry with a weight.
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] ?? 0) > 0) return i;
  return 0;
}

/** A weighted pick from `items` (`weightOf` gives each one's weight). */
export function weightedPick<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  const item = items[weightedIndex(rng, items.map(weightOf))];
  if (item === undefined) throw new Error('weightedPick: no items');
  return item;
}

import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { weightedIndex, weightedPick } from './weighted-pick';

describe('weightedIndex', () => {
  it('never picks a zero weight and follows the weights', () => {
    const rng = new Rng(7);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[weightedIndex(rng, [1, 0, 3])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / 10000).toBeGreaterThan(0.72);
    expect(counts[2]! / 10000).toBeLessThan(0.78);
  });

  it('weightedPick returns the item and is deterministic', () => {
    const a = weightedPick(new Rng(3), ['a', 'b', 'c'], () => 1);
    expect(weightedPick(new Rng(3), ['a', 'b', 'c'], () => 1)).toBe(a);
  });
});

import { describe, expect, it } from 'vitest';
import { createTestState } from './test-state';
import { withBerries, withCoins } from './wallet';

describe('wallet', () => {
  const save = createTestState().data;

  it('adds whole positive amounts', () => {
    expect(withCoins(save, 7.9).coins).toBe(save.coins + 7);
    expect(withBerries(save, 3).berries).toBe(save.berries + 3);
  });
  it('returns the same save when nothing whole and positive is given', () => {
    for (const bad of [0, -5, 0.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(withCoins(save, bad)).toBe(save);
      expect(withBerries(save, bad)).toBe(save);
    }
  });
});

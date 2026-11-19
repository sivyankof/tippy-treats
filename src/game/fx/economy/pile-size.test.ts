import { describe, expect, it } from 'vitest';
import { pileSizeFor } from './pile-size';

describe('pileSizeFor', () => {
  it('grows with the shop berry packs', () => {
    expect([80, 500, 1200, 2800].map((n) => pileSizeFor('berries', n))).toEqual([1, 2, 3, 4]);
  });
  it('grows with the exchange coin packs', () => {
    expect([100, 600, 1400].map((n) => pileSizeFor('coins', n))).toEqual([1, 2, 3]);
  });
  it('never goes below one', () => {
    expect(pileSizeFor('coins', 0)).toBe(1);
    expect(pileSizeFor('berries', -5)).toBe(1);
  });
});

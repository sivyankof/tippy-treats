import { describe, expect, it } from 'vitest';
import { slotAt, slotX } from './home-shelf-math';

describe('home shelf slots', () => {
  it('centres three slots around the middle', () => {
    expect([0, 1, 2].map((i) => slotX(i, 3, 300))).toEqual([-300, 0, 300]);
  });

  it('centres two slots around the middle', () => {
    expect([0, 1].map((i) => slotX(i, 2, 300))).toEqual([-150, 150]);
  });

  it('finds the slot under a tap and clamps outside taps', () => {
    expect(slotAt(-290, 3, 300)).toBe(0);
    expect(slotAt(20, 3, 300)).toBe(1);
    expect(slotAt(310, 3, 300)).toBe(2);
    expect(slotAt(-900, 3, 300)).toBe(0);
    expect(slotAt(900, 3, 300)).toBe(2);
  });
});

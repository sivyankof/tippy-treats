import { describe, expect, it } from 'vitest';
import { placeInSlot } from './team-place';

describe('placeInSlot', () => {
  it('puts a creature into an empty open slot', () => {
    expect(placeInSlot([null, null, null], 'honey', 1, 99)).toEqual([null, 'honey', null]);
  });

  it('moves a creature from another slot', () => {
    expect(placeInSlot(['honey', null, null], 'honey', 1, 99)).toEqual([null, 'honey', null]);
  });

  it('swaps with an occupied slot when moving', () => {
    expect(placeInSlot(['honey', 'puff', null], 'honey', 1, 99)).toEqual(['puff', 'honey', null]);
  });

  it('replaces the occupant of a taken slot for a creature from the grid', () => {
    expect(placeInSlot(['honey', null, null], 'puff', 0, 99)).toEqual(['puff', null, null]);
  });

  it('refuses a locked slot and the same slot', () => {
    const team = ['honey', null, null] as const;
    expect(placeInSlot(team, 'puff', 2, 1)).toBe(team);
    expect(placeInSlot(team, 'honey', 0, 1)).toBe(team);
  });
});

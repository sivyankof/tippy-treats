import { describe, expect, it } from 'vitest';
import {
  addToTeam,
  canFillTeam,
  openSlots,
  removeFromTeam,
  runTeam,
  slotLayers,
  slotOpensAt,
} from './team';

describe('team slots', () => {
  it('opens the third slot at baker level 3', () => {
    expect(openSlots(1)).toBe(2);
    expect(openSlots(2)).toBe(2);
    expect(openSlots(3)).toBe(3);
    expect(slotOpensAt(0)).toBe(1);
    expect(slotOpensAt(1)).toBe(1);
    expect(slotOpensAt(2)).toBe(3);
  });

  it('puts a creature into the first free open slot', () => {
    expect(addToTeam([null, null, null], 'puff', 1)).toEqual(['puff', null, null]);
    expect(addToTeam(['honey', null, null], 'puff', 1)).toEqual(['honey', 'puff', null]);
    expect(addToTeam([null, 'honey', null], 'puff', 3)).toEqual(['puff', 'honey', null]);
  });

  it('does not add a creature twice or into a locked slot', () => {
    const full = ['honey', 'puff', null] as const;
    expect(addToTeam(full, 'jelly', 2)).toBe(full);
    expect(addToTeam(full, 'jelly', 3)).toEqual(['honey', 'puff', 'jelly']);
    expect(addToTeam(full, 'puff', 3)).toBe(full);
  });

  it('empties a slot', () => {
    expect(removeFromTeam(['honey', 'puff', null], 0)).toEqual([null, 'puff', null]);
    const team = ['honey', null, null] as const;
    expect(removeFromTeam(team, 1)).toBe(team);
  });

  it('tells when a free slot could take an owned creature', () => {
    const owned = { honey: { level: 1 }, puff: { level: 1 } };
    expect(canFillTeam(['honey', null, null], owned, 1)).toBe(true);
    expect(canFillTeam(['honey', 'puff', null], owned, 3)).toBe(false);
    expect(canFillTeam(['honey', null, null], { honey: { level: 1 } }, 3)).toBe(false);
  });

  it('builds the run team with owned levels and skips locked or unowned entries', () => {
    const owned = { honey: { level: 2 }, puff: { level: 9 } };
    expect(runTeam(['honey', 'puff', null], owned, 1)).toEqual([
      { id: 'honey', level: 2 },
      { id: 'puff', level: 5 },
      null,
    ]);
    expect(runTeam(['honey', 'jelly', 'puff'], owned, 2)).toEqual([
      { id: 'honey', level: 2 },
      null,
      null,
    ]);
  });

  it('lists the layers the slots arrive at', () => {
    expect(slotLayers()).toEqual([6, 12, 18]);
  });
});

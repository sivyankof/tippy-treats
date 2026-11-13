import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cycleDebugLevel,
  cycleDebugSlot,
  fillSlots,
  getDebugTeam,
  nextLevel,
  nextSlotValue,
  resetDebugTeam,
  toTeamSlots,
} from './debug-team';

describe('debug team', () => {
  afterEach(() => {
    resetDebugTeam();
    vi.unstubAllGlobals();
  });

  function openPage(search: string): void {
    vi.stubGlobal('window', { location: { search } });
  }

  it('cycles a slot through none and every creature', () => {
    expect(nextSlotValue(null)).toBe('honey');
    expect(nextSlotValue('honey')).toBe('puff');
    expect(nextSlotValue('rainbow')).toBeNull();
  });

  it('cycles the level from 5 back to 1', () => {
    expect(nextLevel(1)).toBe(2);
    expect(nextLevel(5)).toBe(1);
  });

  it('fills the slots up to three', () => {
    expect(fillSlots([])).toEqual([null, null, null]);
    expect(fillSlots(['puff'])).toEqual(['puff', null, null]);
    expect(fillSlots(['puff', 'honey', 'jelly', 'lemon'])).toEqual(['puff', 'honey', 'jelly']);
  });

  it('turns the team into sim slots with its level', () => {
    expect(toTeamSlots({ slots: ['honey', null, 'jelly'], level: 4 })).toEqual([
      { id: 'honey', level: 4 },
      null,
      { id: 'jelly', level: 4 },
    ]);
  });

  it('starts empty at the default level and keeps the changes', () => {
    openPage('');
    expect(getDebugTeam()).toEqual({ slots: [null, null, null], level: 3 });
    cycleDebugSlot(1);
    cycleDebugLevel();
    expect(getDebugTeam()).toEqual({ slots: [null, 'honey', null], level: 4 });
    cycleDebugSlot(7);
    expect(getDebugTeam().slots).toEqual([null, 'honey', null]);
  });

  it('takes the first value from the URL', () => {
    openPage('?team=brownie,-,twins&level=5');
    expect(getDebugTeam()).toEqual({ slots: ['brownie', null, 'twins'], level: 5 });
  });
});

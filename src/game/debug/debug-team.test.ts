import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cycleDebugLevel,
  cycleDebugSlot,
  fillSlots,
  getDebugTeam,
  nextLevel,
  nextSlotValue,
  hasDebugTeam,
  resetDebugTeam,
  resolveRunTeam,
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
    expect(toTeamSlots(['honey', null, 'jelly'], 4)).toEqual([
      { id: 'honey', level: 4 },
      null,
      { id: 'jelly', level: 4 },
    ]);
  });

  const saveRun = [{ id: 'honey' as const, level: 2 }, null, null];

  it('keeps the save team when nothing is overridden', () => {
    openPage('');
    expect(hasDebugTeam()).toBe(false);
    expect(getDebugTeam()).toEqual({ slots: null, level: null });
    expect(resolveRunTeam(['honey', null, null], saveRun)).toBe(saveRun);
  });

  it('starts panel changes from the save team at the default level', () => {
    openPage('');
    cycleDebugSlot(1, ['honey', null, null]);
    expect(resolveRunTeam(['honey', null, null], saveRun)).toEqual([
      { id: 'honey', level: 3 },
      { id: 'honey', level: 3 },
      null,
    ]);
    cycleDebugLevel();
    expect(getDebugTeam()).toEqual({ slots: ['honey', 'honey', null], level: 4 });
    cycleDebugSlot(7, []);
    expect(getDebugTeam().slots).toEqual(['honey', 'honey', null]);
  });

  it('takes the team and the level from the URL over the save', () => {
    openPage('?team=brownie,-,twins&level=5');
    expect(resolveRunTeam(['honey', null, null], saveRun)).toEqual([
      { id: 'brownie', level: 5 },
      null,
      { id: 'twins', level: 5 },
    ]);
  });

  it('lifts the save team to the URL level', () => {
    openPage('?level=4');
    expect(resolveRunTeam(['honey', null, null], saveRun)).toEqual([
      { id: 'honey', level: 4 },
      null,
      null,
    ]);
  });
});

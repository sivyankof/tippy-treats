import { describe, expect, it } from 'vitest';
import { closeSteps, pressBeganHere } from './veil-handover';

describe('veil hand-over', () => {
  it('opens the next window before going when the veil is kept', () => {
    expect(closeSteps(true)).toEqual(['onClosed', 'destroy']);
  });

  it('goes first and then reports when the veil fades', () => {
    expect(closeSteps(false)).toEqual(['destroy', 'onClosed']);
  });
});

describe('tap on the veil', () => {
  it('counts only a press that went down on the veil', () => {
    expect(pressBeganHere(1200, 1200)).toBe(true);
    expect(pressBeganHere(1200, 1500)).toBe(false);
    expect(pressBeganHere(-1, 1500)).toBe(false);
  });
});

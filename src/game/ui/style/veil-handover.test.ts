import { describe, expect, it } from 'vitest';
import { closeSteps } from './veil-handover';

describe('veil hand-over', () => {
  it('opens the next window before going when the veil is kept', () => {
    expect(closeSteps(true)).toEqual(['onClosed', 'destroy']);
  });

  it('goes first and then reports when the veil fades', () => {
    expect(closeSteps(false)).toEqual(['destroy', 'onClosed']);
  });
});

import { describe, expect, it } from 'vitest';
import { CONTINUE_ANIM } from '../data/run/continue-anim';
import { continueInput } from './continue-input';

describe('continueInput', () => {
  it('is inactive with a pale caption from the first frame', () => {
    const input = continueInput(0);
    expect(input.active).toBe(false);
    expect(input.declineAlpha).toBe(CONTINUE_ANIM.decline.lockedAlpha);
  });

  it('stays inactive until the delay has passed', () => {
    expect(continueInput(CONTINUE_ANIM.inputDelayMs - 1).active).toBe(false);
  });

  it('switches everything on at the same moment', () => {
    const input = continueInput(CONTINUE_ANIM.inputDelayMs);
    expect(input.active).toBe(true);
    expect(input.declineAlpha).toBe(1);
  });

  it('stays active afterwards', () => {
    expect(continueInput(CONTINUE_ANIM.inputDelayMs * 10).active).toBe(true);
  });
});

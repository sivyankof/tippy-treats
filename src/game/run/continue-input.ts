import { CONTINUE_ANIM } from '../../data/run/continue-anim';

/** What the "Continue?" window lets the player do `elapsedMs` after it opened. */
export interface ContinueInput {
  /** The buttons take taps. Off for the first `inputDelayMs`, then on for good, for every button at once. */
  active: boolean;
  /** Opacity of the "No thanks" caption: pale while inactive. */
  declineAlpha: number;
}

export function continueInput(
  elapsedMs: number,
  delayMs: number = CONTINUE_ANIM.inputDelayMs,
  lockedAlpha: number = CONTINUE_ANIM.decline.lockedAlpha,
): ContinueInput {
  const active = elapsedMs >= delayMs;
  return { active, declineAlpha: active ? 1 : lockedAlpha };
}

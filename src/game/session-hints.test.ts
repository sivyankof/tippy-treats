import { describe, expect, it } from 'vitest';
import { HINT_IDS, SessionHints, TUTORIAL_TEAM } from './session-hints';

describe('SessionHints', () => {
  it('makes only the first run of a session a tutorial run', () => {
    const hints = new SessionHints();
    expect(hints.beginRun()).toBe(true);
    expect(hints.beginRun()).toBe(false);
    expect(hints.beginRun()).toBe(false);
  });

  it('remembers marked hints', () => {
    const hints = new SessionHints();
    expect(hints.has('wobble')).toBe(false);
    hints.mark('wobble');
    expect(hints.has('wobble')).toBe(true);
  });

  it('forced on, every run is a tutorial run with fresh hints', () => {
    const hints = new SessionHints();
    for (let i = 0; i < 3; i++) {
      expect(hints.beginRun(true)).toBe(true);
      expect(HINT_IDS.filter((id) => id !== 'tutorial').some((id) => hints.has(id))).toBe(false);
      hints.mark('tap');
    }
  });

  it('forced off, no run is a tutorial run and every hint counts as shown', () => {
    const hints = new SessionHints();
    expect(hints.beginRun(false)).toBe(false);
    expect(HINT_IDS.every((id) => hints.has(id))).toBe(true);
  });

  it('gives the tutorial team honey in the first slot only', () => {
    expect(TUTORIAL_TEAM).toEqual([{ id: 'honey', level: 1 }, null, null]);
  });
});

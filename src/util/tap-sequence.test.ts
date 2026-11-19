import { describe, expect, it } from 'vitest';
import { createTapSequence } from './tap-sequence';

describe('createTapSequence', () => {
  it('fires on the fifth quick tap and starts over', () => {
    let time = 0;
    const seq = createTapSequence(5, 1000, () => time);
    const results = [0, 100, 200, 300, 400].map((t) => {
      time = t;
      return seq.tap();
    });
    expect(results).toEqual([false, false, false, false, true]);
    time = 500;
    expect(seq.tap()).toBe(false);
  });

  it('forgets taps that fall out of the window', () => {
    let time = 0;
    const seq = createTapSequence(3, 1000, () => time);
    for (const t of [0, 500, 1600]) {
      time = t;
      expect(seq.tap()).toBe(false);
    }
    time = 1700;
    expect(seq.tap()).toBe(false);
    time = 1800;
    expect(seq.tap()).toBe(true);
  });
});

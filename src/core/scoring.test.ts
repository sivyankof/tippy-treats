import { describe, expect, it } from 'vitest';
import { comboWidening, nextCombo, normalScore, perfectScore } from './scoring';

describe('combo', () => {
  it('counts perfect drops and resets on a normal one', () => {
    expect(nextCombo(0, true)).toBe(1);
    expect(nextCombo(6, true)).toBe(7);
    expect(nextCombo(6, false)).toBe(0);
  });

  it('widens the layer by 20 from the fourth perfect drop in a row', () => {
    expect(comboWidening(3, 400)).toBe(0);
    expect(comboWidening(4, 400)).toBe(20);
    expect(comboWidening(12, 400)).toBe(20);
  });

  it('never widens past the tray width', () => {
    expect(comboWidening(5, 710)).toBe(10);
    expect(comboWidening(5, 720)).toBe(0);
  });
});

describe('score', () => {
  it('gives 10 for a normal drop', () => {
    expect(normalScore(1)).toBe(10);
    expect(normalScore(1.2)).toBe(12);
  });

  it('gives 25 + 5 per combo step for a perfect drop, capped at combo 10', () => {
    expect(perfectScore(1, 1)).toBe(30);
    expect(perfectScore(4, 1)).toBe(45);
    expect(perfectScore(10, 1)).toBe(75);
    expect(perfectScore(40, 1)).toBe(75);
  });

  it('applies zone and ability multipliers', () => {
    expect(perfectScore(2, 1.5)).toBe(53);
    expect(perfectScore(10, 2.5)).toBe(188);
  });
});

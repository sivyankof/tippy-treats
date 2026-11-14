import { describe, expect, it } from 'vitest';
import { lettersShown, shakeAngle, splitLetters } from './new-creature-reveal';

describe('lettersShown', () => {
  it('adds a letter per step and stops at the total', () => {
    expect(lettersShown(5, 0, 50)).toBe(0);
    expect(lettersShown(5, 120, 50)).toBe(2);
    expect(lettersShown(5, 9999, 50)).toBe(5);
  });
  it('handles empty text and zero step', () => {
    expect(lettersShown(0, 100, 50)).toBe(0);
    expect(lettersShown(4, 0, 0)).toBe(4);
  });
});

describe('splitLetters', () => {
  it('fills the first line before the second', () => {
    expect(splitLetters([4, 3], 2)).toEqual([2, 0]);
    expect(splitLetters([4, 3], 6)).toEqual([4, 2]);
    expect(splitLetters([4, 3], 20)).toEqual([4, 3]);
  });
});

describe('shakeAngle', () => {
  it('starts calm and swings wider towards the end', () => {
    expect(shakeAngle(0, 10, 8)).toBe(0);
    expect(Math.abs(shakeAngle(0.05, 10, 8))).toBeLessThan(1);
    expect(Math.abs(shakeAngle(0.95, 11, 8))).toBeGreaterThan(5);
  });
});

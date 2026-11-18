import { describe, expect, it } from 'vitest';
import { shortened, stretchesFor } from './notes';

describe('shortened', () => {
  it('scales the length and the loudness and moves a delay with the time', () => {
    const base = { delay: 0.2, duration: 0.5, gain: 0.4, freq: 300 };
    expect(shortened(base, 0.5, 0.5)).toEqual({ delay: 0.1, duration: 0.25, gain: 0.2, freq: 300 });
    expect(base.duration).toBe(0.5);
  });

  it('leaves an untimed recipe without a delay', () => {
    expect('delay' in shortened({ duration: 1, gain: 1 }, 0.5, 1)).toBe(false);
  });
});

describe('stretchesFor', () => {
  it('counts the stretches that cover the time', () => {
    expect(stretchesFor(1, 0.34)).toBe(3);
    expect(stretchesFor(0.8, 0.4)).toBe(2);
    expect(stretchesFor(0.1, 0.34)).toBe(1);
    expect(stretchesFor(1, 0)).toBe(1);
  });
});

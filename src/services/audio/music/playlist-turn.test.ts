import { describe, expect, it } from 'vitest';
import { MUSIC, MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';
import { firstIndex, nextIndex, turnLength, turnOffset } from './playlist-turn';

const shape = (track: MusicTrackId) => ({
  loopSec: MUSIC_TRACKS[track].frames / MUSIC_TRACKS[track].sampleRate,
  seamless: MUSIC_TRACKS[track].loop === 'seamless',
});

describe('turnLength', () => {
  it('a seamless track plays whole loops, at least the minimum', () => {
    const kitchen = turnLength(shape('kitchen'), MUSIC.minPlaySec, MUSIC.crossfadeSec);
    expect(kitchen / shape('kitchen').loopSec).toBeCloseTo(3, 9);
    expect(kitchen).toBeCloseTo(205.71, 1);
    expect(turnLength(shape('roof'), 150, 2.5)).toBeCloseTo(264, 6);
    expect(turnLength(shape('stars'), 150, 2.5)).toBeCloseTo(192, 6);
    expect(turnLength(shape('space'), 150, 2.5)).toBeCloseTo(224.42, 1);
    for (const track of ['kitchen', 'roof', 'stars', 'space'] as const) {
      expect(turnLength(shape(track), 150, 2.5)).toBeGreaterThanOrEqual(150);
    }
  });

  it('a loop exactly the minimum plays once', () => {
    expect(turnLength({ loopSec: 150, seamless: true }, 150, 2.5)).toBe(150);
    expect(turnLength({ loopSec: 75, seamless: true }, 150, 2.5)).toBe(150);
  });

  it('a non-seamless file plays once, the change ending with it', () => {
    expect(turnLength(shape('menu'), 150, 2.5)).toBeCloseTo(shape('menu').loopSec - 2.5, 9);
    expect(turnLength(shape('bartender'), 150, 2.5)).toBeCloseTo(127.5, 9);
  });
});

describe('turnOffset', () => {
  it('a seamless turn goes on inside its loop, a file at its time', () => {
    expect(turnOffset({ loopSec: 60, seamless: true }, 130)).toBeCloseTo(10, 9);
    expect(turnOffset({ loopSec: 168, seamless: false }, 50)).toBe(50);
    expect(turnOffset({ loopSec: 60, seamless: true }, 0)).toBe(0);
  });
});

describe('firstIndex and nextIndex', () => {
  it('any first track can come, and the order goes round', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 1; r += 0.05) seen.add(firstIndex(() => r, 6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(firstIndex(() => 0.999_999, 6)).toBe(5);
    expect(nextIndex(5, 6)).toBe(0);
    expect(nextIndex(2, 6)).toBe(3);
  });
});

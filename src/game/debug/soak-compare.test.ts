import { describe, expect, it } from 'vitest';
import { differing, soundNodes, type SmokeCounts } from './soak-compare';

const BASE: SmokeCounts = {
  objects: 100,
  listeners: 50,
  tweens: 3,
  rawTweens: 5,
  timers: 2,
  audioNodes: 10,
};

describe('differing', () => {
  it('is empty for equal counts', () => {
    expect(differing(BASE, { ...BASE })).toEqual([]);
  });

  it('names the compared counts that differ, not the reported ones', () => {
    expect(differing(BASE, { ...BASE, objects: 101, timers: 9, rawTweens: 1 })).toEqual([
      'objects',
    ]);
    expect(differing(BASE, { ...BASE, listeners: 49, tweens: 4 })).toEqual(['listeners', 'tweens']);
  });

  it('lets the audio node count move within the tolerance only', () => {
    expect(differing(BASE, { ...BASE, audioNodes: 14 }, 5)).toEqual([]);
    expect(differing(BASE, { ...BASE, audioNodes: 16 }, 5)).toEqual(['audioNodes']);
    expect(differing({ ...BASE, audioNodes: 20 }, BASE, 5)).toEqual(['audioNodes']);
  });
});

describe('soundNodes', () => {
  it('leaves the music nodes out of the live count', () => {
    expect(soundNodes({ liveNodes: 70, musicNodes: 61 })).toBe(9);
    expect(soundNodes({ liveNodes: 40, musicNodes: 30 })).toBe(10);
  });

  it('so the beat phase of the music cannot move the compared count', () => {
    const quiet = { liveNodes: 30 + 4, musicNodes: 30 };
    const busy = { liveNodes: 61 + 4, musicNodes: 61 };
    expect(
      differing(
        { ...BASE, audioNodes: soundNodes(quiet) },
        { ...BASE, audioNodes: soundNodes(busy) },
        0,
      ),
    ).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../../../data/creatures/creatures';
import { TRANSFORM } from '../../../data/creatures/transform-scene';
import { transformCues, transformFrame, transformKind } from './transform-plan';

describe('transformKind', () => {
  it('plays a scene on the step to the new look and on the step to the master level only', () => {
    for (const id of CREATURE_IDS) {
      const kinds = Array.from({ length: MAX_CREATURE_LEVEL }, (_, i) => transformKind(id, i + 1));
      expect(kinds).toEqual([null, 'look', null, 'master', null]);
    }
  });
});

describe('transformCues', () => {
  it('is no longer than 1.6 s on every level of effects', () => {
    expect(transformCues(false).totalMs).toBeLessThanOrEqual(1600);
    expect(transformCues(true).totalMs).toBeLessThanOrEqual(1600);
  });

  it('swaps the look while the cloud covers the creature', () => {
    const cues = transformCues(false);
    const covered = transformFrame(cues.swapMs, 'look', false);
    expect(covered.hidden).toBe(true);
    expect(transformFrame(cues.swapMs - 1, 'look', false).mix).toBe(0);
    expect(covered.mix).toBe(1);
  });
});

describe('transformFrame', () => {
  it('ends with nothing left on the screen', () => {
    for (const minimal of [false, true]) {
      const end = transformFrame(transformCues(minimal).totalMs, 'master', minimal);
      expect(end.fade).toBe(0);
    }
  });

  it('shows rays and a ring only for the master, and not on minimal effects', () => {
    const at = transformCues(false).flashMs + TRANSFORM.holdMs / 2;
    expect(transformFrame(at, 'master', false).rays).toBeGreaterThan(0);
    expect(transformFrame(at, 'master', false).ring).toBeGreaterThan(0);
    expect(transformFrame(at, 'look', false).rays).toBe(0);
    expect(transformFrame(at, 'look', false).ring).toBe(-1);
    const flat = transformFrame(transformCues(true).flashMs + 10, 'master', true);
    expect(flat.rays).toBe(0);
    expect(flat.ring).toBe(-1);
    expect(flat.angle).toBe(0);
  });

  it('flows the old picture into the new one on minimal effects', () => {
    const mid = transformFrame(TRANSFORM.minimalSwapMs / 2, 'look', true);
    expect(mid.mix).toBeGreaterThan(0);
    expect(mid.mix).toBeLessThan(1);
    expect(mid.hidden).toBe(false);
  });
});

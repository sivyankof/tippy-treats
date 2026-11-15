import { describe, expect, it } from 'vitest';
import { PLAIN_TOPPERS, TOPPER_KINDS } from '../../data/plain-toppers';
import { plainLookAt } from './plain-look';
import {
  carriedOffset,
  popAt,
  popLaunch,
  sideOfOffset,
  topperAt,
  topperOffset,
  topperSize,
  type PopPose,
} from './topper-look';

const SEED = 12345;

describe('topperAt', () => {
  it('is the same for the same seed and layer', () => {
    for (let n = 1; n <= 60; n++) {
      expect(topperAt(SEED, n, null)).toEqual(topperAt(SEED, n, null));
    }
  });

  it('never gives a topper to a layer with a small decoration', () => {
    for (let n = 1; n <= 300; n++) expect(topperAt(SEED, n, 'berries')).toBeNull();
  });

  it('keeps the choice of the bare layers independent of the decoration stream', () => {
    for (let n = 1; n <= 100; n++) {
      const bare = topperAt(SEED, n, null);
      if (bare) expect(PLAIN_TOPPERS.kinds[bare.kind]).toBeDefined();
    }
  });

  it('gives about one plain layer in six a topper, and every kind turns up', () => {
    const total = 3000;
    const kinds = new Set<string>();
    let count = 0;
    for (let n = 1; n <= total; n++) {
      const t = topperAt(SEED, n, plainLookAt(SEED, n).decor);
      if (!t) continue;
      count++;
      kinds.add(t.kind);
    }
    expect(count / total).toBeGreaterThan(0.13);
    expect(count / total).toBeLessThan(0.2);
    expect([...kinds].sort()).toEqual([...TOPPER_KINDS].sort());
  });

  it('puts toppers on both sides', () => {
    const sides = new Set<number>();
    for (let n = 1; n <= 200; n++) {
      const t = topperAt(SEED, n, null);
      if (t) sides.add(t.side);
    }
    expect(sides).toEqual(new Set([-1, 1]));
  });
});

describe('topperOffset', () => {
  it('sits beside the face on its side, inside the layer', () => {
    for (const kind of TOPPER_KINDS) {
      const half = topperSize(kind).halfBody;
      for (const side of [-1, 1] as const) {
        const dx = topperOffset(kind, side, 400, 60)!;
        expect(Math.sign(dx)).toBe(side);
        expect(Math.abs(dx) - half).toBeGreaterThanOrEqual(60);
        expect(Math.abs(dx) + half).toBeLessThanOrEqual(200);
      }
    }
  });

  it('has no place on a layer too narrow to leave room beside the face', () => {
    expect(topperOffset('lemon', 1, 120, 60)).toBeNull();
  });
});

describe('carriedOffset', () => {
  it('keeps the world place when the layer was not moved', () => {
    expect(carriedOffset('cherry', 150, 0, 400, 60)).toBe(150);
  });

  it('follows the centre when a bite moved it', () => {
    expect(carriedOffset('cherry', 150, 40, 320, 60)).toBe(110);
  });

  it('is gone when the bite took its place', () => {
    expect(carriedOffset('cherry', 190, -100, 160, 40)).toBeNull();
  });

  it('is pushed off the face when the new centre came close', () => {
    expect(Math.abs(carriedOffset('cherry', 70, 60, 400, 60)!)).toBeGreaterThanOrEqual(60 + 24);
  });
});

describe('sideOfOffset', () => {
  it('tells the side of the face an offset is on', () => {
    expect(sideOfOffset(-80)).toBe(-1);
    expect(sideOfOffset(80)).toBe(1);
  });
});

describe('pop-off', () => {
  const pose = (): PopPose => ({ dx: 0, dy: 0, angleDeg: 0, scaleX: 1, scaleY: 1, alpha: 1 });

  it('is deterministic and flies towards its side', () => {
    expect(popLaunch(SEED, 7, 1)).toEqual(popLaunch(SEED, 7, 1));
    expect(popLaunch(SEED, 7, 1).vx).toBeGreaterThan(0);
    expect(popLaunch(SEED, 7, -1).vx).toBeLessThan(0);
    expect(popLaunch(SEED, 7, -1).spinDeg).toBeLessThan(0);
  });

  it('starts squashed, springs back, rises, falls and fades out', () => {
    const launch = popLaunch(SEED, 7, 1);
    const start = popAt(launch, 0, pose());
    expect(start.scaleX).toBeGreaterThan(1);
    expect(start.scaleY).toBeLessThan(1);
    expect(popAt(launch, PLAIN_TOPPERS.hop.springMs, pose()).scaleX).toBe(1);
    expect(popAt(launch, 100, pose()).dy).toBeLessThan(0);
    expect(popAt(launch, PLAIN_TOPPERS.hop.lifeMs, pose()).dy).toBeGreaterThan(0);
    expect(popAt(launch, PLAIN_TOPPERS.hop.lifeMs, pose()).alpha).toBe(0);
  });
});

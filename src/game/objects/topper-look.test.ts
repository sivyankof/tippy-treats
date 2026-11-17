import { describe, expect, it } from 'vitest';
import { PLAIN_TOPPERS, TOPPER_KINDS } from '../../data/plain-toppers';
import { plainLookAt } from './plain-look';
import {
  carriedOffset,
  popAt,
  popLaunch,
  sideOfOffset,
  topperAt,
  topperFor,
  topperOffset,
  topperSize,
  type LayerFacts,
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

  it('gives about one plain layer in four a topper, and every kind turns up', () => {
    const total = 3000;
    const kinds = new Set<string>();
    let count = 0;
    for (let n = 1; n <= total; n++) {
      const t = topperAt(SEED, n, plainLookAt(SEED, n).decor);
      if (!t) continue;
      count++;
      kinds.add(t.kind);
    }
    expect(count / total).toBeGreaterThan(0.22);
    expect(count / total).toBeLessThan(0.3);
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

describe('topperFor first-run guarantee', () => {
  const { guaranteeFrom, guaranteeTo } = PLAIN_TOPPERS;
  const WIDE = 600;

  /** Layer kinds of a run: every `period`-th layer starting at `offset` is not plain. */
  function layersOf(period: number, offset: number, width = WIDE): LayerFacts[] {
    return Array.from({ length: 30 }, (_, i) => ({
      plain: period === 0 || (i + offset) % period !== 0,
      width,
    }));
  }

  function shown(seed: number, layers: LayerFacts[], upTo: number): number[] {
    const out: number[] = [];
    for (let n = 1; n <= upTo; n++) if (topperFor(seed, n, layers)) out.push(n);
    return out;
  }

  it('shows a topper within the first ten layers whenever a wide bare plain layer exists from 4 to 10', () => {
    for (const [period, offset] of [
      [0, 0],
      [2, 0],
      [3, 1],
      [4, 2],
    ] as const) {
      const layers = layersOf(period, offset);
      for (let seed = 1; seed <= 1500; seed++) {
        const canHave = Array.from({ length: guaranteeTo - guaranteeFrom + 1 }, (_, i) => {
          const n = guaranteeFrom + i;
          return layers[n - 1]!.plain && plainLookAt(seed, n).decor === null;
        }).some(Boolean);
        if (!canHave) continue;
        expect(shown(seed, layers, guaranteeTo).length).toBeGreaterThan(0);
      }
    }
  });

  it('never puts a topper on a layer that is not plain', () => {
    const layers = layersOf(2, 0);
    for (let seed = 1; seed <= 500; seed++) {
      for (let n = 1; n <= 30; n++) {
        if (!layers[n - 1]!.plain) expect(topperFor(seed, n, layers)).toBeNull();
      }
    }
  });

  it('is the same for the same seed and the same layers', () => {
    const layers = layersOf(3, 0);
    for (let seed = 1; seed <= 200; seed++) {
      expect(shown(seed, layers, 12)).toEqual(shown(seed, layers, 12));
    }
  });

  it('gives only one topper by the guarantee, none when an earlier layer had one by chance', () => {
    const layers = layersOf(0, 0);
    let guaranteed = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const early = shown(seed, layers, guaranteeFrom - 1);
      const inRange = shown(seed, layers, guaranteeTo).filter((n) => n >= guaranteeFrom);
      const bareFirst = Array.from(
        { length: guaranteeTo - guaranteeFrom + 1 },
        (_, i) => i + guaranteeFrom,
      ).find((n) => plainLookAt(seed, n).decor === null);
      if (early.length > 0 || bareFirst === undefined) continue;
      guaranteed++;
      expect(inRange).toContain(bareFirst);
    }
    expect(guaranteed).toBeGreaterThan(0);
  });

  it('skips a layer too narrow for the topper', () => {
    const layers = layersOf(0, 0, 40);
    for (let seed = 1; seed <= 300; seed++) expect(shown(seed, layers, 30)).toEqual([]);
  });
});

describe('topperSize', () => {
  it('keeps the anchor on the same spot of the drawing when the field grows', () => {
    for (const kind of TOPPER_KINDS) {
      const { width, height, restY, field } = PLAIN_TOPPERS.kinds[kind];
      const k = PLAIN_TOPPERS.showScale;
      const size = topperSize(kind);
      expect(size.width).toBeCloseTo((width + field.left + field.right) * k);
      expect(size.height).toBeCloseTo((height + field.top + field.bottom) * k);
      // The anchor, measured from the top-left of the picture, is the drawn anchor plus the left / top field.
      expect(size.originX * size.width).toBeCloseTo((width / 2 + field.left) * k);
      expect(size.restY).toBeCloseTo((restY + field.top) * k);
    }
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

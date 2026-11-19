import { afterEach, describe, expect, it } from 'vitest';
import type { FlyingLayer } from '../../../../core/tower/sim-types';
import { BALANCE } from '../../../../data/tower/balance';
import type { CreatureId } from '../../../../data/creatures/creatures';
import { EDGE_SQUASH } from '../../../../data/tower/edge-squash';
import { effectsMode } from '../../../effects-mode';
import type { EdgeShape } from './edge-squash';
import { BUBBLE_RIBS } from './edge-squash-ribs';
import { FlyingEdgeSquash, type Walls, type WallTouch } from './flying-edge-squash';
import type { LayerView } from '../layer-view';

const WALLS: Walls = { left: 12, right: 1068 };
const { base, max } = BALANCE.speed;
const by = EDGE_SQUASH.byPower;
const MS = 16;

interface Hit {
  touch: WallTouch | null;
  /** Hold times of the faces the view was asked to pull, ms. */
  faces: number[];
  /** Strength of the strokes of the left wall in the first drawn frame after the touch. */
  strokes: number;
  shape: EdgeShape | null;
  /** The squash after the last frame, to ask for the mouth of the face. */
  squash: FlyingEdgeSquash;
}

/** A layer of `creature` that flies left into the left wall at the share `power` of the speed range. */
function hitWall(creature: CreatureId | null, power: number): Hit {
  const squash = new FlyingEdgeSquash();
  const faces: number[] = [];
  let shape: EdgeShape | null = null;
  const view = {
    y: 0,
    scaleX: 1,
    innerScaleX: 1,
    faceView: { react: (_: string, ms: number) => faces.push(ms) },
    setEdgeSquash: (s: EdgeShape | null) => {
      shape = s;
    },
  } as unknown as LayerView;
  const layer = {
    kind: creature ? 'creature' : 'plain',
    creature,
    index: 7,
    x: 400,
    width: 720,
    dir: -1,
    speed: base + (max - base) * power,
  } as unknown as FlyingLayer;
  squash.reset(layer, WALLS, 7);
  let touch: WallTouch | null = null;
  for (let x = 400; x >= 120; x -= 4) {
    layer.x = x;
    squash.step(layer, WALLS, true, 0, MS, view);
    touch = squash.takeTouch() ?? touch;
    squash.draw(view, x, layer.width, WALLS);
  }
  const drawn = shape as EdgeShape | null;
  return { touch, faces, strokes: drawn ? drawn.left.hitGain : 0, shape: drawn, squash };
}

afterEach(() => effectsMode.pinLevel(null));

describe('speed gating of the wall touch', () => {
  it('a slow layer gives no drops, no strokes and no squint', () => {
    const hit = hitWall(null, 0);
    expect(hit.touch).toBeNull();
    expect(hit.strokes).toBe(0);
    expect(hit.faces).toEqual([]);
  });

  it('a fast layer throws 3 drops, shows the strokes and squints for the full time', () => {
    const hit = hitWall(null, 1);
    expect(hit.touch?.drops).toBe(by.drops.count);
    expect(hit.touch?.dropSize).toBeCloseTo(1, 9);
    expect(hit.strokes).toBeCloseTo(1, 9);
    expect(hit.faces).toEqual([EDGE_SQUASH.feel.normal.faceMs]);
  });

  it('grows smoothly in between: drops, their size, the strokes and the squint ramp in', () => {
    let drops = 0;
    let size = 0;
    let strokes = 0;
    let squint = 0;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const hit = hitWall(null, Math.min(1, p));
      const nowDrops = hit.touch?.drops ?? 0;
      const nowSize = hit.touch?.dropSize ?? 0;
      const nowSquint = hit.faces[0] ?? 0;
      expect(nowDrops).toBeGreaterThanOrEqual(drops);
      expect(nowDrops - drops).toBeLessThanOrEqual(1);
      if (nowDrops > 0) expect(nowSize).toBeGreaterThanOrEqual(by.drops.size - 1e-9);
      expect(nowSize).toBeGreaterThanOrEqual(size - 1e-9);
      expect(hit.strokes - strokes).toBeLessThan(0.15);
      expect(hit.strokes).toBeGreaterThanOrEqual(strokes - 1e-9);
      expect(nowSquint).toBeGreaterThanOrEqual(squint - 1e-9);
      expect(nowSquint - squint).toBeLessThan(EDGE_SQUASH.feel.normal.faceMs * 0.3);
      drops = nowDrops;
      size = nowSize;
      strokes = hit.strokes;
      squint = nowSquint;
    }
    expect(strokes).toBeGreaterThan(0.99);
  });

  it('the drops start tiny and the stroke strength starts from nothing', () => {
    const hit = hitWall(null, (by.drops.from + by.drops.full) / 2 - 0.2);
    if (hit.touch) expect(hit.touch.dropSize).toBeLessThan(0.8);
    const weak = hitWall(null, by.strokes.from + 0.05);
    expect(weak.strokes).toBeGreaterThan(0);
    expect(weak.strokes).toBeLessThan(0.2);
  });

  it('a soft layer splashes like a normal one', () => {
    const hit = hitWall('jelly', 1);
    expect(hit.touch?.drops).toBe(by.drops.count);
    expect(hit.strokes).toBeCloseTo(1, 9);
  });

  it('a hard layer only knocks off crumbs, at any speed: no drops, no strokes, always the gape', () => {
    for (const creature of ['caramel', 'brownie', 'crumb', 'frosty'] as const) {
      for (const p of [0, 0.5, 1]) {
        const hit = hitWall(creature, p);
        expect(hit.touch?.drops).toBe(0);
        expect(hit.touch?.knock).not.toBeNull();
        expect(hit.strokes).toBe(0);
        expect(hit.faces).toEqual([EDGE_SQUASH.feel.hard.faceMs]);
      }
    }
  });

  it('fewer effects: only the wedge, no drops, strokes or ribs', () => {
    effectsMode.pinLevel('minimal');
    const hit = hitWall(null, 1);
    expect(hit.touch).toBeNull();
    expect(hit.strokes).toBe(0);
    expect(hit.shape?.ribbing).toBe(false);
    expect(hit.shape?.left.depth).toBeGreaterThan(0);
    expect(hit.shape?.left.rise).toBeGreaterThan(0);
    const hard = hitWall('brownie', 1);
    expect(hard.touch).toBeNull();
  });
});

describe('ribs by material', () => {
  it('gives a soft layer with a wavy top one smooth bubble and no ribs, any other the ribs of its number', () => {
    for (const creature of ['jelly', 'puff'] as const) {
      expect(hitWall(creature, 1).shape?.ribs).toBe(BUBBLE_RIBS);
    }
    for (const creature of [null, 'honey', 'sprinkle'] as const) {
      const ribs = hitWall(creature, 1).shape?.ribs;
      expect(ribs).not.toBeNull();
      expect(ribs).not.toBe(BUBBLE_RIBS);
      expect(ribs?.top.start.length).toBe(EDGE_SQUASH.ribs.slots.top);
      expect(ribs?.bottom.start.length).toBe(EDGE_SQUASH.ribs.slots.bottom);
    }
  });
});

describe('the face at the wall', () => {
  it('a slow layer keeps a calm face: the worried o of the aim is held back, the smile stays', () => {
    const slow = hitWall(null, 0);
    expect(slow.squash.wallMouth('o')).toBe('smile');
    expect(slow.squash.wallMouth('smile')).toBe('smile');
    expect(slow.squash.wallMouth('open')).toBe('open');
  });

  it('the face is let to change as the speed grows: the o is back from the middle of the squint ramp', () => {
    const { from, full, mouthFrom } = by.squint;
    const at = (share: number): number => from + (full - from) * share;
    expect(hitWall(null, at(mouthFrom - 0.2)).squash.wallMouth('o')).toBe('smile');
    expect(hitWall(null, at(mouthFrom + 0.2)).squash.wallMouth('o')).toBe('o');
    expect(hitWall(null, 1).squash.wallMouth('o')).toBe('o');
  });

  it('a hard layer and a layer away from the wall keep whatever the aim says', () => {
    expect(hitWall('brownie', 0).squash.wallMouth('o')).toBe('o');
    const away = new FlyingEdgeSquash();
    expect(away.wallMouth('o')).toBe('o');
  });
});

import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { BALANCE } from '../../data/balance';
import { EFFECT_LEVELS } from '../../data/effect-levels';
import { TOPPER_SQUASH } from '../../data/topper-squash';
import { faceHalfSpan } from './glaze-growth';
import {
  burstCount,
  burstStates,
  classifySquash,
  crouchScale,
  crouchStep,
  edgeLaunch,
  rollSpots,
  squashLevelPlan,
  stainSpot,
} from './topper-squash-plan';

describe('classifySquash', () => {
  it('is a hit when the whole body is under the layer', () => {
    expect(classifySquash(300, 30, 300, 400)).toBe('hit');
    expect(classifySquash(440, 30, 300, 400)).toBe('hit');
  });

  it('is an edge shot when the middle is under the layer but the body sticks out', () => {
    expect(classifySquash(480, 30, 300, 400)).toBe('edge');
    expect(classifySquash(120, 30, 300, 400)).toBe('edge');
  });

  it('is a miss when the middle is past the edge of the layer', () => {
    expect(classifySquash(520, 30, 300, 400)).toBe('miss');
    expect(classifySquash(700, 30, 300, 400)).toBe('miss');
  });

  it('keeps a small margin at the edge', () => {
    const edge = 200 - 30 - TOPPER_SQUASH.hitMarginPx;
    expect(classifySquash(300 + edge, 30, 300, 400)).toBe('hit');
    expect(classifySquash(300 + edge + 1, 30, 300, 400)).toBe('edge');
  });
});

describe('squashLevelPlan', () => {
  it('plays everything on full', () => {
    expect(squashLevelPlan('full')).toEqual({ play: true, crouch: true, dip: true, trace: true });
  });

  it('keeps the squash and the trace on lite, without the dip', () => {
    expect(squashLevelPlan('lite')).toEqual({ play: true, crouch: true, dip: false, trace: true });
  });

  it('plays nothing on minimal', () => {
    expect(squashLevelPlan('minimal')).toEqual({
      play: false,
      crouch: false,
      dip: false,
      trace: false,
    });
  });

  it('knows every level', () => {
    for (const level of EFFECT_LEVELS) expect(squashLevelPlan(level)).toBeDefined();
  });
});

describe('crouch', () => {
  it('eases towards the target and lands on it', () => {
    let c = 0;
    let last = 0;
    for (let i = 0; i < 100; i++) {
      c = crouchStep(c, 1, 16.7);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
    expect(c).toBe(1);
    for (let i = 0; i < 100; i++) c = crouchStep(c, 0, 16.7);
    expect(c).toBe(0);
  });

  it('does not jump in one frame', () => {
    expect(crouchStep(0, 1, 16.7)).toBeLessThan(0.2);
  });

  it('scales down by the data at full crouch', () => {
    expect(crouchScale(0)).toEqual({ x: 1, y: 1 });
    expect(crouchScale(1).y).toBeCloseTo(TOPPER_SQUASH.crouch.scaleY);
  });
});

describe('edgeLaunch', () => {
  it('flies away from the layer, up and spinning the same way', () => {
    const right = edgeLaunch(1, new Rng(1));
    expect(right.vx).toBeGreaterThan(TOPPER_SQUASH.edge.speedX[0] - 1);
    expect(right.vy).toBeLessThan(0);
    expect(right.spinDeg).toBeGreaterThan(0);
    const left = edgeLaunch(-1, new Rng(1));
    expect(left.vx).toBeLessThan(0);
    expect(left.spinDeg).toBeLessThan(0);
  });
});

describe('stainSpot', () => {
  it('stays clear of the face and of the side of the layer', () => {
    const { stain } = TOPPER_SQUASH;
    for (const width of [300, 480, 720]) {
      const face = faceHalfSpan(width, null);
      for (const topperDx of [-300, -60, 0, 60, 300]) {
        const spot = stainSpot(width, face, topperDx);
        if (!spot) continue;
        expect(Math.abs(spot.dx) - stain.width / 2).toBeGreaterThanOrEqual(face + stain.faceGapPx);
        expect(Math.abs(spot.dx) + stain.width / 2).toBeLessThanOrEqual(
          width / 2 - stain.edgeGapPx,
        );
      }
    }
  });

  it('keeps the side of the topper', () => {
    const face = faceHalfSpan(720, null);
    expect(stainSpot(720, face, -200)!.dx).toBeLessThan(0);
    expect(stainSpot(720, face, 200)!.dx).toBeGreaterThan(0);
  });

  it('sits under the glaze and inside the layer', () => {
    const spot = stainSpot(720, faceHalfSpan(720, null), 200)!;
    const stain = TOPPER_SQUASH.stain;
    const bottom = spot.dy + (1 - stain.originY) * stain.height;
    expect(spot.dy).toBeGreaterThan(-BALANCE.layer.height / 2 + 20);
    expect(bottom).toBeLessThan(BALANCE.layer.height / 2);
  });

  it('is none on a layer too narrow to hold it beside the face', () => {
    expect(stainSpot(120, faceHalfSpan(120, null), 30)).toBeNull();
  });
});

describe('rollSpots', () => {
  it('puts the rolls at the two ends of the seam', () => {
    const [left, right] = rollSpots(500, 600, 520, 300)!;
    expect(left.dx).toBeCloseTo(520 - 150 - 500);
    expect(right.dx).toBeCloseTo(520 + 150 - 500);
    expect(left.side).toBe(-1);
    expect(right.side).toBe(1);
  });

  it('uses the edges of the lower layer when the upper one is wider', () => {
    const [left, right] = rollSpots(500, 300, 500, 600)!;
    expect(left.dx).toBeCloseTo(-150);
    expect(right.dx).toBeCloseTo(150);
  });

  it('sits at the seam', () => {
    const [left] = rollSpots(500, 600, 500, 600)!;
    expect(left.dy).toBeLessThan(-BALANCE.layer.height / 2 + 10);
  });

  it('is none when the layers barely overlap', () => {
    expect(rollSpots(500, 300, 760, 300)).toBeNull();
  });
});

describe('burstStates', () => {
  const burst = TOPPER_SQUASH.kinds.cherry.burst;

  it('counts inside the range and draws the same number of values each time', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const n = burstCount(burst, a);
    expect(n).toBeGreaterThanOrEqual(burst.count[0]);
    expect(n).toBeLessThanOrEqual(burst.count[1]);
    burstCount(burst, b);
    expect(burstStates(burst, n, 0, 0, 1, a)).toHaveLength(n);
    burstStates(burst, n, 0, 0, -1, b);
    expect(a.next()).toBe(b.next());
  });

  it('flies up and outwards to the chosen side', () => {
    for (const p of burstStates(burst, 20, 10, 20, 1, new Rng(3))) {
      expect(p.vx).toBeGreaterThan(0);
      expect(p.vy).toBeLessThan(0);
    }
    for (const p of burstStates(burst, 20, 10, 20, -1, new Rng(3))) expect(p.vx).toBeLessThan(0);
  });

  it('is the same for the same seed', () => {
    expect(burstStates(burst, 5, 0, 0, 1, new Rng(9))).toEqual(
      burstStates(burst, 5, 0, 0, 1, new Rng(9)),
    );
  });
});

describe('squash data', () => {
  it('has 5-7 berry drops and 3-4 mint leaves', () => {
    expect(TOPPER_SQUASH.kinds.cherry.burst.count).toEqual([5, 7]);
    expect(TOPPER_SQUASH.kinds.strawberry.burst.count).toEqual([5, 7]);
    expect(TOPPER_SQUASH.kinds.mint.burst.count).toEqual([3, 4]);
  });
});

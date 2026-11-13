import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { CREATURE_LOOKS } from '../../data/creature-looks';
import { CREATURE_IDS } from '../../data/creatures';
import { browTransform, faceLayout, lidShape, WORRIED_BROW } from './face-recipe';

describe('lidShape', () => {
  it('puts the lid line at the middle of the eye for a half-closed eye', () => {
    const lid = lidShape(0.5);
    expect(lid.y).toBeCloseTo(0);
    expect(lid.scaleY).toBeGreaterThan(0);
  });

  it('a higher lid line is narrower and lower in height', () => {
    const high = lidShape(0.3);
    const half = lidShape(0.5);
    expect(high.y).toBeLessThan(half.y);
    expect(high.scaleX).toBeLessThan(half.scaleX);
    expect(high.scaleY).toBeLessThan(half.scaleY);
  });

  it('clamps the cover to the eye', () => {
    expect(lidShape(-1).scaleY).toBe(0);
    expect(lidShape(5).y).toBeCloseTo(ANIM.face.eyeRadius);
  });
});

describe('browTransform', () => {
  it('turns the inner ends up for a positive angle, mirrored between the sides', () => {
    const pose = { angleDeg: 20, offsetY: 0, scaleX: 1, scaleY: 1 };
    expect(browTransform(pose, 'left').angle).toBe(-20);
    expect(browTransform(pose, 'right').angle).toBe(20);
  });

  it('adds the pose offset to the standard brow line and keeps the scale', () => {
    const t = browTransform({ angleDeg: -10, offsetY: -12, scaleX: 1.3, scaleY: 1.6 }, 'right');
    expect(t.y).toBe(ANIM.face.browOffsetY - 12);
    expect([t.scaleX, t.scaleY]).toEqual([1.3, 1.6]);
  });

  it('the worried pose is the plain "ouch" brow', () => {
    expect(browTransform(WORRIED_BROW, 'left').angle).toBe(-ANIM.face.browRaiseDeg);
  });
});

describe('faceLayout', () => {
  it('shrinks a plain face below the full width and keeps only eyes below the eyes-only width', () => {
    expect(faceLayout(400, null)).toEqual({ scale: 1, showRest: true });
    expect(faceLayout(100, null).scale).toBe(100 / ANIM.face.fullWidth);
    expect(faceLayout(ANIM.face.eyesOnlyWidth - 1, null).showRest).toBe(false);
  });

  it('twins use their own widths', () => {
    const twins = CREATURE_LOOKS.twins.face;
    const pair = twins.pair;
    expect(pair).not.toBeNull();
    if (!pair) return;
    expect(faceLayout(pair.fullWidth, twins).scale).toBe(1);
    expect(faceLayout(pair.fullWidth / 2, twins).scale).toBe(0.5);
    expect(faceLayout(pair.eyesOnlyWidth - 1, twins).showRest).toBe(false);
  });
});

describe('creature face recipes', () => {
  it('exist for all creatures and only twins have a pair of faces', () => {
    for (const id of CREATURE_IDS) {
      expect(CREATURE_LOOKS[id].face).toBeDefined();
      expect(CREATURE_LOOKS[id].face.pair !== null).toBe(id === 'twins');
    }
  });

  it('give honey and rainbow sleepy eyes, lemon an asymmetric squint and nobody else a lid', () => {
    for (const id of CREATURE_IDS) {
      const { lidLeft, lidRight } = CREATURE_LOOKS[id].face;
      const sleepy = id === 'honey' || id === 'rainbow';
      expect(lidLeft > 0).toBe(sleepy);
      expect(lidRight > 0).toBe(sleepy || id === 'lemon');
    }
  });

  it('lemon and caramel have uneven brows', () => {
    for (const id of ['lemon', 'caramel'] as const) {
      const { browLeft, browRight } = CREATURE_LOOKS[id].face;
      expect(browLeft).not.toEqual(browRight);
    }
  });
});

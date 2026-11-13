import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { layerSpeed, resolveDrop, type DropInput } from './drop';

const TARGET = 540;

const drop = (dx: number, overrides: Partial<DropInput> = {}) =>
  resolveDrop({
    flyingX: TARGET + dx,
    width: 400,
    targetX: TARGET,
    perfectTolerance: BALANCE.drop.perfectTolerance,
    autoPerfect: false,
    springShare: 0,
    ...overrides,
  });

describe('resolveDrop', () => {
  it.each([0, 20, -20, 4.5])('is perfect at dx = %d and keeps the width', (dx) => {
    expect(drop(dx)).toEqual({
      quality: 'perfect',
      dx,
      newWidth: 400,
      centerOffset: 0,
      cutWidth: 0,
      cutSide: null,
    });
  });

  it('cuts the right overhang on a normal drop to the right', () => {
    expect(drop(100)).toEqual({
      quality: 'normal',
      dx: 100,
      newWidth: 300,
      centerOffset: 50,
      cutWidth: 100,
      cutSide: 'right',
    });
  });

  it('cuts the left overhang on a normal drop to the left', () => {
    expect(drop(-60)).toEqual({
      quality: 'normal',
      dx: -60,
      newWidth: 340,
      centerOffset: -30,
      cutWidth: 60,
      cutSide: 'left',
    });
  });

  it('turns normal just outside the perfect tolerance', () => {
    expect(drop(20.5).quality).toBe('normal');
    expect(drop(-20.5).quality).toBe('normal');
  });

  it('misses once the remainder would be narrower than the margin', () => {
    const edge = 400 - BALANCE.drop.missMargin;
    expect(drop(edge - 1).quality).toBe('normal');
    expect(drop(edge - 1).newWidth).toBe(BALANCE.drop.missMargin + 1);
    expect(drop(edge).quality).toBe('miss');
    expect(drop(-edge).quality).toBe('miss');
    expect(drop(900)).toMatchObject({ quality: 'miss', newWidth: 0, cutSide: null });
  });

  it('does not depend on width for the perfect tolerance', () => {
    expect(drop(20, { width: 60 }).quality).toBe('perfect');
    expect(drop(22, { width: 60 }).quality).toBe('normal');
    expect(drop(36, { width: 60 }).quality).toBe('miss');
  });

  it('checks the perfect tolerance before the miss margin on very narrow layers', () => {
    expect(drop(20, { width: 40 }).quality).toBe('perfect');
    expect(drop(21, { width: 40 }).quality).toBe('miss');
  });

  it('forgives a small offset with a wider (sticky) tolerance', () => {
    expect(drop(28).quality).toBe('normal');
    expect(drop(28, { perfectTolerance: 30 })).toMatchObject({
      quality: 'perfect',
      newWidth: 400,
      centerOffset: 0,
    });
    expect(drop(31, { perfectTolerance: 30 }).quality).toBe('normal');
  });

  it('auto-perfect turns a normal drop into a perfect one', () => {
    expect(drop(100, { autoPerfect: true })).toMatchObject({
      quality: 'perfect',
      dx: 100,
      newWidth: 400,
      centerOffset: 0,
      cutWidth: 0,
    });
    expect(drop(-375, { autoPerfect: true }).quality).toBe('perfect');
  });

  it('auto-perfect does not save a complete miss', () => {
    const edge = 400 - BALANCE.drop.missMargin;
    expect(drop(edge, { autoPerfect: true }).quality).toBe('miss');
    expect(drop(-900, { autoPerfect: true })).toMatchObject({ quality: 'miss', newWidth: 0 });
  });

  it('auto-perfect keeps the tolerance rule on narrow layers', () => {
    expect(drop(20, { width: 40, autoPerfect: true }).quality).toBe('perfect');
    expect(drop(21, { width: 40, autoPerfect: true }).quality).toBe('miss');
  });
});

describe('resolveDrop with a spring', () => {
  it('pulls a normal drop towards the centre and cuts less', () => {
    expect(drop(100, { springShare: 0.4 })).toMatchObject({
      quality: 'normal',
      dx: 60,
      newWidth: 340,
      centerOffset: 30,
      cutWidth: 60,
      cutSide: 'right',
    });
    expect(drop(-100, { springShare: 0.5 })).toMatchObject({
      dx: -50,
      newWidth: 350,
      centerOffset: -25,
      cutWidth: 50,
      cutSide: 'left',
    });
  });

  it('decides perfect by the raw offset', () => {
    expect(drop(20, { springShare: 0.6 })).toMatchObject({ quality: 'perfect', cutWidth: 0 });
    // Just outside the tolerance stays normal even though the settled offset would fit in it.
    const outside = drop(20.5, { springShare: 0.6 });
    expect(outside.quality).toBe('normal');
    expect(outside.dx).toBeCloseTo(8.2);
  });

  it('decides a miss by the raw offset', () => {
    const edge = 400 - BALANCE.drop.missMargin;
    expect(drop(edge, { springShare: 0.6 }).quality).toBe('miss');
    expect(drop(edge - 1, { springShare: 0.6 }).quality).toBe('normal');
  });

  it('leaves auto-perfect and a zero share as they were', () => {
    expect(drop(100, { autoPerfect: true, springShare: 0.6 })).toMatchObject({
      quality: 'perfect',
      dx: 100,
    });
    expect(drop(100, { springShare: 0 })).toMatchObject({ dx: 100, newWidth: 300 });
  });
});

describe('layerSpeed', () => {
  it('grows with height and is capped', () => {
    expect(layerSpeed(0, 1)).toBe(600);
    expect(layerSpeed(10, 1)).toBe(690);
    expect(layerSpeed(88, 1)).toBe(1392);
    expect(layerSpeed(89, 1)).toBe(1400);
    expect(layerSpeed(500, 1)).toBe(1400);
  });

  it('applies the zone multiplier after the cap', () => {
    expect(layerSpeed(0, 1.05)).toBeCloseTo(630);
    expect(layerSpeed(500, 1.1)).toBeCloseTo(1540);
  });
});

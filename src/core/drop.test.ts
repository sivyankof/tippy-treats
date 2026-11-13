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
    ...overrides,
  });

describe('resolveDrop', () => {
  it.each([0, 10, -10, 4.5])('is perfect at dx = %d and keeps the width', (dx) => {
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
    expect(drop(10.5).quality).toBe('normal');
    expect(drop(-10.5).quality).toBe('normal');
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
    expect(drop(10, { width: 40 }).quality).toBe('perfect');
    expect(drop(12, { width: 40 }).quality).toBe('normal');
    expect(drop(16, { width: 40 }).quality).toBe('miss');
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

  it('auto-perfect lands anything, even a would-be miss', () => {
    expect(drop(390, { autoPerfect: true })).toMatchObject({
      quality: 'perfect',
      dx: 390,
      newWidth: 400,
    });
  });
});

describe('layerSpeed', () => {
  it('grows with height and is capped', () => {
    expect(layerSpeed(0, 1)).toBe(520);
    expect(layerSpeed(10, 1)).toBe(610);
    expect(layerSpeed(97, 1)).toBe(1393);
    expect(layerSpeed(98, 1)).toBe(1400);
    expect(layerSpeed(500, 1)).toBe(1400);
  });

  it('applies the zone multiplier after the cap', () => {
    expect(layerSpeed(0, 1.05)).toBeCloseTo(546);
    expect(layerSpeed(500, 1.1)).toBeCloseTo(1540);
  });
});

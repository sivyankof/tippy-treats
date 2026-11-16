import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { FIELD_BOUNDS, growInField } from './field';

const MAX = BALANCE.layer.maxWidth;

const edges = (s: { x: number; width: number }) => [s.x - s.width / 2, s.x + s.width / 2];

describe('growInField', () => {
  it('grows a centred layer symmetrically', () => {
    expect(growInField(540, 400, 30, MAX)).toEqual({ x: 540, width: 430 });
  });

  it('grows a layer at the right edge to the left', () => {
    const out = growInField(880, 400, 60, MAX);
    expect(out.width).toBe(460);
    expect(edges(out)[1]).toBe(FIELD_BOUNDS.right);
    expect(edges(out)[0]).toBe(620);
  });

  it('grows a layer at the left edge to the right', () => {
    const out = growInField(200, 400, 60, MAX);
    expect(out.width).toBe(460);
    expect(edges(out)[0]).toBe(FIELD_BOUNDS.left);
  });

  it('keeps a layer that fits unchanged when it does not grow', () => {
    expect(growInField(300, 200, 0, MAX)).toEqual({ x: 300, width: 200 });
  });

  it('never exceeds the maximum width, even with a huge increase', () => {
    const out = growInField(880, 700, 500, MAX);
    expect(out.width).toBe(BALANCE.layer.maxWidth);
    expect(edges(out)[0]).toBeGreaterThanOrEqual(FIELD_BOUNDS.left);
    expect(edges(out)[1]).toBeLessThanOrEqual(FIELD_BOUNDS.right);
  });

  it('an increase larger than the room on both sides stays inside the field', () => {
    for (const x of [100, 540, 1000]) {
      const out = growInField(x, 600, 1000, MAX);
      expect(out.width).toBeLessThanOrEqual(BALANCE.layer.maxWidth);
      expect(edges(out)[0]).toBeGreaterThanOrEqual(FIELD_BOUNDS.left);
      expect(edges(out)[1]).toBeLessThanOrEqual(FIELD_BOUNDS.right);
    }
  });

  it('pulls a layer that already sticks out back inside', () => {
    const out = growInField(1000, 300, 0, MAX);
    expect(out.width).toBe(300);
    expect(edges(out)[1]).toBe(FIELD_BOUNDS.right);
  });

  it('ignores a negative amount', () => {
    expect(growInField(540, 400, -50, MAX).width).toBe(400);
  });
});

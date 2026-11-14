import { describe, expect, it } from 'vitest';
import type { PlacedLayer } from '../../core/sim-types';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { freeRoom, pennantSide } from './pennant-side';

const layer = (x: number, width: number): PlacedLayer => ({
  x,
  width,
  kind: 'plain',
  quality: 'normal',
});

describe('record pennant placement', () => {
  it('measures the room beside the layer at the record height', () => {
    const state = { layers: [layer(540, 720), layer(600, 600), layer(700, 400)], bonusHeight: 0 };
    expect(freeRoom(state, 2)).toEqual({ left: 300, right: LOGICAL_SIZE.width - 900 });
  });

  it('uses the top layer while the tower is still below the record', () => {
    const state = { layers: [layer(540, 720), layer(400, 500)], bonusHeight: 0 };
    expect(freeRoom(state, 10)).toEqual({ left: 150, right: LOGICAL_SIZE.width - 650 });
  });

  it('counts the twins bonus height and leaves the whole screen free without layers', () => {
    expect(freeRoom({ layers: [], bonusHeight: 0 }, 5).left).toBe(LOGICAL_SIZE.width);
    const state = { layers: [layer(540, 720), layer(300, 400)], bonusHeight: 1 };
    expect(freeRoom(state, 3)).toEqual({ left: 100, right: LOGICAL_SIZE.width - 500 });
  });

  it('moves to the roomier side only past the hysteresis', () => {
    const margin = CONTINUE_ANIM.flag.sideHysteresis;
    expect(pennantSide(1, { left: 200 + margin, right: 200 })).toBe(1);
    expect(pennantSide(1, { left: 201 + margin, right: 200 })).toBe(-1);
    expect(pennantSide(-1, { left: 200, right: 201 + margin })).toBe(1);
    expect(pennantSide(-1, { left: 200, right: 230 })).toBe(-1);
  });
});

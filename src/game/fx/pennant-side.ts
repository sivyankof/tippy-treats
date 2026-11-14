import type { TowerState } from '../../core/tower-sim';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { LOGICAL_SIZE } from '../../data/screen';

const flag = CONTINUE_ANIM.flag;

/** Free room left and right of the tower at the record height (the top layer while the tower is lower). */
export function freeRoom(
  state: Pick<TowerState, 'layers' | 'bonusHeight'>,
  best: number,
): { left: number; right: number } {
  const index = Math.min(state.layers.length, Math.max(1, best - state.bonusHeight)) - 1;
  const layer = state.layers[index];
  if (!layer) return { left: LOGICAL_SIZE.width, right: LOGICAL_SIZE.width };
  return {
    left: layer.x - layer.width / 2,
    right: LOGICAL_SIZE.width - (layer.x + layer.width / 2),
  };
}

/** Keeps the pennant on its side unless the other side has clearly more room. */
export function pennantSide(current: 1 | -1, room: { left: number; right: number }): 1 | -1 {
  const here = current === 1 ? room.right : room.left;
  const there = current === 1 ? room.left : room.right;
  if (there > here + flag.sideHysteresis) return current === 1 ? -1 : 1;
  return current;
}

import { BALANCE } from '../data/balance';
import { SPACE_ZONE_INDEX, ZONE_RULES } from '../data/zones';
import { zoneStartIndex } from './zones';

/** Lap of Space a 1-based layer index lies in: 1 for layers 101-120, 2 for 121-140…; 0 before Space. */
export function spaceLap(index: number): number {
  const first = zoneStartIndex(SPACE_ZONE_INDEX);
  if (index < first) return 0;
  return Math.floor((index - first) / BALANCE.zones.length) + 1;
}

/**
 * The widest a layer of this index may be: the full `maxWidth` up to lap 1 of Space, then
 * `max(floor, 1 - step * (lap - 1))` of it (docs/02-gameplay.md, section 8, "Сужение витков").
 */
export function spaceWidthLimit(
  index: number,
  laps: { step: number; floor: number } = ZONE_RULES.spaceLaps,
): number {
  const { maxWidth } = BALANCE.layer;
  const lap = spaceLap(index);
  if (lap <= 1) return maxWidth;
  const { step, floor } = laps;
  return Math.max(floor, 1 - step * (lap - 1)) * maxWidth;
}

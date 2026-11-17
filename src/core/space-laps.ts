import { BALANCE } from '../data/balance';
import { LAP_REWARD, SPACE_ZONE_INDEX, ZONE_RULES } from '../data/zones';
import { zoneStartIndex } from './zones';

/** Lap of Space a 1-based layer index lies in: 1 for layers 101-120, 2 for 121-140…; 0 before Space. */
export function spaceLap(index: number): number {
  const first = zoneStartIndex(SPACE_ZONE_INDEX);
  if (index < first) return 0;
  return Math.floor((index - first) / BALANCE.zones.length) + 1;
}

/** Index of the first layer of a lap of Space (lap 1 starts with the zone). */
export function lapFirstIndex(lap: number): number {
  return zoneStartIndex(SPACE_ZONE_INDEX) + (Math.max(lap, 1) - 1) * BALANCE.zones.length;
}

/** Lap of Space of the layer in flight when `height` layers are placed (the layer with index `height + 1`); 0 before Space. */
export function flyingLap(height: number): number {
  return spaceLap(height + 1);
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

/**
 * Where a tower `layers` tall (the fractional height of the camera view) stands in Space: its lap (0 before Space) and the
 * progress through it, 0 at the first layer of the lap to 1 at its last.
 */
export function lapProgress(layers: number): { lap: number; progress: number } {
  const start = zoneStartIndex(SPACE_ZONE_INDEX) - 1;
  if (layers < start) return { lap: 0, progress: 0 };
  const laps = (layers - start) / BALANCE.zones.length;
  const lap = Math.floor(laps);
  return { lap: lap + 1, progress: laps - lap };
}

/** Extra score multiplier of a lap, on top of the Space one: `min(maxBonus, perLap * (lap - 1))`, 0 outside Space. */
export function lapScoreBonus(
  lap: number,
  rules: { perLap: number; maxBonus: number } = ZONE_RULES.spaceScore,
): number {
  if (lap <= 1) return 0;
  return Math.min(rules.maxBonus, rules.perLap * (lap - 1));
}

/** The score multiplier a layer of this index earns from its zone: the zone one plus the lap bonus. */
export function layerZoneScoreMult(index: number, zoneMult: number): number {
  return zoneMult + lapScoreBonus(spaceLap(index));
}

/**
 * Berries for the laps a Classic run reached for the first time: `LAP_REWARD.berries` for each lap
 * above `bestLap` (the highest lap ever reached) up to the run's lap, within the rewarded laps.
 */
export function lapRewardBerries(
  bestLap: number,
  height: number,
  reward: { berries: number; fromLap: number; toLap: number } = LAP_REWARD,
): number {
  const reached = Math.min(spaceLap(Math.floor(height)), reward.toLap);
  const from = Math.max(reward.fromLap, Math.floor(bestLap) + 1);
  return reached < from ? 0 : (reached - from + 1) * reward.berries;
}

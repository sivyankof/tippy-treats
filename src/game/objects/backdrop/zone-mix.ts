import { ANIM } from '../../../data/common/anim';
import type { ZoneId } from '../../../data/zones/zones';

/**
 * A number that depends on the zone, blended the way the backdrop is drawn: the zone being flowed
 * into fades in over the old ones, which stay fully drawn underneath, so each zone contributes its
 * visible part (`alpha`, or `alpha * (1 - alpha of the current zone)` for an old one). The result is the
 * mean of the zone values weighted by those parts, so it follows the cross-fade and never jumps.
 * Pure and allocation-free (it runs every frame).
 */
export function zoneMixOf(
  indices: Iterable<number>,
  current: number,
  zoneAt: (index: number) => ZoneId,
  alphaAt: (index: number) => number,
  valueOf: (zone: ZoneId) => number,
): number {
  const covered = 1 - alphaAt(current);
  let sum = 0;
  let weight = 0;
  for (const index of indices) {
    const share = index === current ? alphaAt(index) : alphaAt(index) * covered;
    sum += share * valueOf(zoneAt(index));
    weight += share;
  }
  return weight > 0 ? sum / weight : valueOf(zoneAt(current));
}

/** Halo alpha multiplier of a zone (1 where the data lists none). */
export function haloZoneMult(zone: ZoneId): number {
  return ANIM.combo.haloZoneMult[zone] ?? 1;
}

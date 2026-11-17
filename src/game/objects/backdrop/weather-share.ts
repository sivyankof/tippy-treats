import type { WeatherView } from '../../../data/weather';
import type { ZoneId } from '../../../data/zones';

/**
 * How much of one kind of weather view is visible: the sum of the zone alphas of the zones that
 * show weather that way, clamped to 0..1. Pure, so the fade across a zone change can be tested.
 */
export function weatherShareOf(
  view: Exclude<WeatherView, 'none'>,
  zones: readonly { zone: ZoneId; alpha: number }[],
  zoneView: Record<ZoneId, WeatherView>,
): number {
  let sum = 0;
  for (const { zone, alpha } of zones) if (zoneView[zone] === view) sum += alpha;
  return Math.min(Math.max(sum, 0), 1);
}

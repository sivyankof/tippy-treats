import { WEATHER, type WeatherView } from '../../../data/weather';
import type { ZoneId } from '../../../data/zones';

/**
 * How much of one kind of weather view is visible: the sum of the fade alphas of the zones that
 * show weather that way, clamped to 0..1. Pure and allocation-free (it runs every frame), so the
 * fade across a zone change can be tested.
 */
export function weatherShareOf(
  view: Exclude<WeatherView, 'none'>,
  indices: Iterable<number>,
  zoneAt: (index: number) => ZoneId,
  alphaAt: (index: number) => number,
  zoneView: Record<ZoneId, WeatherView>,
): number {
  let sum = 0;
  for (const index of indices) if (zoneView[zoneAt(index)] === view) sum += alphaAt(index);
  return Math.min(Math.max(sum, 0), 1);
}

/** Whether a zone has the weather's sky pieces (the cloud bank and bolt, the stars and the moon): only the zones that show all of it. */
export function zoneShowsWeatherSky(zone: ZoneId): boolean {
  return WEATHER.zoneView[zone] === 'full';
}

/**
 * Whether the pieces that stand on the tower or fall in front of the backdrop (particles, snow cap,
 * splashes) may show: the zone cross-fade must let some weather through and the tower must stand.
 */
export function towerWeatherShown(share: number, layerCount: number, over: boolean): boolean {
  return share > 0 && layerCount > 0 && !over;
}

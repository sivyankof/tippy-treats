import type { EffectLevel } from '../data/effect-levels';
import type { WeatherId } from '../data/weather';
import { WEATHER_BED, type BedKind } from '../data/weather-bed';

/**
 * The bed that should sound now, or `null`: only when the owner's switch (`WEATHER_BED.enabled`) is
 * on, the weather has a bed, the weather is on screen (`share` above 0) and the effects level is
 * not minimal. Pure, so the decision is tested.
 */
export function bedWanted(
  weather: WeatherId,
  share: number,
  level: EffectLevel,
  enabled: boolean = WEATHER_BED.enabled,
): BedKind | null {
  if (!enabled || level === 'minimal' || share <= 0) return null;
  return WEATHER_BED.byWeather[weather] ?? null;
}

import { ZONE_SKY, type GradientStop } from '../../../../data/backdrop/backdrop-colors';
import type { WeatherId } from '../../../../data/weather/weather';
import {
  WEATHER_LOOK,
  type PerZone,
  type WeatherZone,
} from '../../../../data/weather/weather-look';
import type { ZoneId } from '../../../../data/zones/zones';

const SKY: Partial<Record<WeatherId, PerZone<readonly GradientStop[]>>> = WEATHER_LOOK.sky;
const FAR_LIGHT: Partial<Record<WeatherId, PerZone<number>>> = WEATHER_LOOK.farLight;
const LAYER_TINT: Partial<Record<WeatherId, PerZone<readonly number[]>>> = WEATHER_LOOK.layerTint;
const MOUNTAIN_TINT: Partial<Record<WeatherId, number>> = WEATHER_LOOK.mountainTint;
const FIXTURE_TINT: Partial<Record<WeatherId, number>> = WEATHER_LOOK.fixtureTint;

function weatherZone(zone: ZoneId): WeatherZone | null {
  return zone === 'roof' || zone === 'clouds' ? zone : null;
}

/** Sky gradient of a zone in a weather (clear and the zones that show no weather keep the zone's own). */
export function skyStops(zone: ZoneId, weather: WeatherId): readonly GradientStop[] {
  const wz = weatherZone(zone);
  return (wz && SKY[weather]?.[wz]) ?? ZONE_SKY[zone];
}

/** The pale colour of the far plane silhouettes in a weather, `null` for the zone's own. */
export function farLightOf(zone: ZoneId, weather: WeatherId): number | null {
  const wz = weatherZone(zone);
  return (wz && FAR_LIGHT[weather]?.[wz]) ?? null;
}

/** Multiply tints of the four parallax layers in a weather, `null` when the weather leaves them alone. */
export function layerTintsOf(zone: ZoneId, weather: WeatherId): readonly number[] | null {
  const wz = weatherZone(zone);
  return (wz && LAYER_TINT[weather]?.[wz]) ?? null;
}

export function mountainTintOf(weather: WeatherId): number | null {
  return MOUNTAIN_TINT[weather] ?? null;
}

export function fixtureTintOf(weather: WeatherId): number | null {
  return FIXTURE_TINT[weather] ?? null;
}

/** Key suffix of the pictures that differ by weather: empty for clear and for weathers that only tint. */
export function skySuffix(zone: ZoneId, weather: WeatherId): string {
  return weatherZone(zone) && SKY[weather] ? `_${weather}` : '';
}

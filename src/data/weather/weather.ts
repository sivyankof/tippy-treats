import type { ZoneId } from '../zones/zones';

export const WEATHER_IDS = ['clear', 'sunset', 'night', 'rain', 'snow', 'leaves', 'storm'] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === 'string' && (WEATHER_IDS as readonly string[]).includes(value);
}

/** How much of the weather a zone shows: all of it, only what is seen through the window, or nothing. */
export type WeatherView = 'full' | 'window' | 'none';

/** Run weather: cosmetic only, it never touches speed, width or rules. */
export const WEATHER = {
  /** Relative chance of each weather per run (they add up to 100). */
  shares: {
    clear: 25,
    rain: 15,
    snow: 15,
    night: 13,
    sunset: 12,
    leaves: 10,
    storm: 10,
  } satisfies Record<WeatherId, number>,
  /** No more than this many equal non-clear weathers in a row across the runs of a session. */
  maxSameInARow: 2,
  zoneView: {
    kitchen: 'window',
    showcase: 'window',
    roof: 'full',
    clouds: 'full',
    stars: 'none',
    space: 'none',
  } satisfies Record<ZoneId, WeatherView>,
  // --- Art numbers (palettes, particle counts per effects level, ...) go below this line. ---
} as const;

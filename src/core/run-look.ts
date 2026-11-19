import { START_PLACES, type StartPlaceId } from '../data/zones/start-places';
import { WEATHER, WEATHER_IDS, type WeatherId } from '../data/weather/weather';
import { Rng } from './rng';
import { weightedPick } from './weighted-pick';

/** The cosmetic look of one run: it never changes how the run plays. */
export interface RunLook {
  weather: WeatherId;
  place: StartPlaceId;
  /** Stream of the run seed for the planets of the laps of Space (`planetOfLap`). */
  planetSeed: number;
}

const weatherShare = (id: WeatherId): number => WEATHER.shares[id];

function inStreak(weather: WeatherId, recent: readonly WeatherId[]): boolean {
  const need = WEATHER.maxSameInARow;
  return recent.length >= need && recent.slice(-need).every((id) => id === weather);
}

/**
 * The weather of a run from its seed. `recent` is the weather of the previous runs (oldest first):
 * when the last `maxSameInARow` of them are all one non-clear weather and the pick is that
 * weather again, it is drawn anew among the others from the same stream.
 */
export function pickWeather(seed: number, recent: readonly WeatherId[]): WeatherId {
  const rng = new Rng(seed).fork('weather');
  const pick = weightedPick(rng, WEATHER_IDS, weatherShare);
  if (pick === 'clear' || !inStreak(pick, recent)) return pick;
  return weightedPick(
    rng,
    WEATHER_IDS.filter((id) => id !== pick),
    weatherShare,
  );
}

/** The place of zone 1 from the run seed. */
export function pickStartPlace(seed: number): StartPlaceId {
  return weightedPick(new Rng(seed).fork('place'), START_PLACES, (place) => place.share).id;
}

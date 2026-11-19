import { pickStartPlace, pickWeather, type RunLook } from '../core/run-look';
import { planetSeedOf } from '../core/space-planet';
import { DEFAULT_START_PLACE, type StartPlaceId } from '../data/zones/start-places';
import { WEATHER, type WeatherId } from '../data/weather/weather';

/** What decides the look of one run. */
export interface RunLookInput {
  seed: number;
  /** The daily tower: same look for every player, so it ignores (and does not feed) the session history. */
  daily?: boolean;
  /** The tutorial run: always clear weather in the kitchen. */
  tutorial?: boolean;
  /** `?weather=` / `?place=` of a dev build. */
  debug?: { weather?: WeatherId; place?: StartPlaceId };
  /** `?perf=1` benchmark: clear and the kitchen unless the parameters name them. */
  perf?: { weather?: WeatherId; place?: StartPlaceId };
}

const PLAIN_WEATHER: WeatherId = 'clear';

/** Weather of the runs of this session, oldest first; in memory only, never saved. */
let history: WeatherId[] = [];

/** Long enough for the streak rule, short enough to stay tiny. */
const HISTORY_CAP = WEATHER.maxSameInARow + 1;

/** Forgets the session history (tests). */
export function resetRunLookHistory(): void {
  history = [];
}

/**
 * The look of a run: the benchmark and the tutorial are clear + kitchen, a dev parameter pins one
 * or both, the daily tower plays its seed alone, any other run picks from its seed and the
 * session history and remembers its weather.
 */
export function chooseRunLook(input: RunLookInput): RunLook {
  const planetSeed = planetSeedOf(input.seed);
  if (input.perf) {
    return {
      weather: input.perf.weather ?? PLAIN_WEATHER,
      place: input.perf.place ?? DEFAULT_START_PLACE,
      planetSeed,
    };
  }
  if (input.tutorial) return { weather: PLAIN_WEATHER, place: DEFAULT_START_PLACE, planetSeed };
  const pinned = input.debug;
  const daily = input.daily === true;
  const weather = pinned?.weather ?? pickWeather(input.seed, daily ? [] : history);
  const place = pinned?.place ?? pickStartPlace(input.seed);
  // Only a real pick joins the history: a pinned weather says nothing about luck.
  if (!daily && pinned?.weather === undefined) {
    history = [...history, weather].slice(-HISTORY_CAP);
  }
  return { weather, place, planetSeed };
}

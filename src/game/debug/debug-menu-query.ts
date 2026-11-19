import { BALANCE } from '../../data/tower/balance';
import { CHECKPOINT_HEIGHTS } from '../../data/zones/checkpoints';
import { START_PLACES, type StartPlaceId } from '../../data/zones/start-places';
import { ZONES } from '../../data/zones/zones';
import { WEATHER_IDS, type WeatherId } from '../../data/weather/weather';

/** What the menu's lists have picked; `null` leaves that parameter out (the game rolls it). */
export interface DebugMenuChoice {
  /** Layers pre-placed at the start of the run (`?start=`). */
  startHeight: number;
  place: StartPlaceId | null;
  weather: WeatherId | null;
  fps: boolean;
  panel: boolean;
}

export const DEFAULT_MENU_CHOICE: DebugMenuChoice = {
  startHeight: 0,
  place: null,
  weather: null,
  fps: false,
  panel: false,
};

export interface StartOption {
  height: number;
  zone: string;
  checkpoint: boolean;
}

/** The start of every zone; those that are checkpoint heights say so. */
export const START_OPTIONS: readonly StartOption[] = ZONES.map((zone, i) => {
  const height = i * BALANCE.zones.length;
  return {
    height,
    zone: zone.id,
    checkpoint: (CHECKPOINT_HEIGHTS as readonly number[]).includes(height),
  };
});

export const PLACE_OPTIONS: readonly StartPlaceId[] = START_PLACES.map((place) => place.id);
export const WEATHER_OPTIONS: readonly WeatherId[] = WEATHER_IDS;

/** The query of a run from the chosen point. `?start=` is always there: it also keeps the run out of the save. */
export function composeRunQuery(choice: DebugMenuChoice): string {
  const params = new URLSearchParams({ start: String(choice.startHeight) });
  if (choice.place !== null) params.set('place', choice.place);
  if (choice.weather !== null) params.set('weather', choice.weather);
  if (choice.panel) params.set('debug', '1');
  if (choice.fps) params.set('fps', '1');
  return params.toString();
}

/** The benchmark queries of the two buttons. */
export const PERF_QUERY = {
  noTeam: 'perf=1',
  masterTeam: 'perf=1&mastery=master',
} as const;

export const SOUNDBOARD_QUERY = 'soundboard=1';

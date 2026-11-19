/**
 * Where zone 1 (layers 1-20) takes place. A new place is one entry here plus its art
 * (`PLACE_ART` in the backdrop); `share` is its relative chance per run.
 */
export const START_PLACES = [
  { id: 'kitchen', share: 50 },
  { id: 'shop', share: 50 },
] as const;

export type StartPlaceId = (typeof START_PLACES)[number]['id'];

export function isStartPlaceId(value: unknown): value is StartPlaceId {
  return typeof value === 'string' && START_PLACES.some((place) => place.id === value);
}

/** The place of benchmark, tutorial and menu runs. */
export const DEFAULT_START_PLACE: StartPlaceId = 'kitchen';

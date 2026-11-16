import { SPACE_PLANET_IDS, type SpacePlanetId } from '../data/space-planets';

/** The dessert planet of a lap of Space: the nine in order, then again from the first; lap 0 or less counts as lap 1. */
export function planetOfLap(lap: number): SpacePlanetId {
  const turn = Math.max(lap, 1) - 1;
  return SPACE_PLANET_IDS[turn % SPACE_PLANET_IDS.length] as SpacePlanetId;
}

/**
 * Notices when a run moves into a higher lap of Space from lap 2 on. Like the zone watch, the first
 * lap it sees is only a baseline (no plate at the start, with a debug start or after a restart);
 * a lower lap resets the baseline silently.
 */
export class LapChangeWatch {
  private last: number | null = null;

  constructor(private readonly firstLap: number) {}

  /** Feed the lap of the run every frame (`null` when no run is there yet); returns the lap to announce, if any. */
  observe(lap: number | null): number | null {
    if (lap === null) return null;
    const previous = this.last;
    this.last = lap;
    return previous !== null && lap > previous && lap >= this.firstLap ? lap : null;
  }
}

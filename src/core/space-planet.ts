import { SPACE_PLANET_IDS, type SpacePlanetId } from '../data/space-planets';
import { Rng } from './rng';

/** The stream of a run seed that decides the planets of its laps (a cosmetic stream, like the weather's). */
export function planetSeedOf(seed: number): number {
  return new Rng(seed).fork('planets').seed;
}

/** The order of the nine planets in one block of nine laps: a shuffle by the seed and the block. */
function blockOrder(planetSeed: number, block: number): SpacePlanetId[] {
  const rng = new Rng(planetSeed).fork(`block${block}`);
  const order = [...SPACE_PLANET_IDS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j] as SpacePlanetId, order[i] as SpacePlanetId];
  }
  return order;
}

/**
 * The dessert planet of a lap of Space: every block of nine laps shows all nine planets once, in an order that
 * depends on the run's planet seed (`planetSeedOf`); the first planet of a block is never the last one of the block
 * before, so a planet does not come twice in a row. Lap 0 or less counts as lap 1.
 */
export function planetOfLap(planetSeed: number, lap: number): SpacePlanetId {
  const turn = Math.max(lap, 1) - 1;
  const block = Math.floor(turn / SPACE_PLANET_IDS.length);
  let order = blockOrder(planetSeed, 0);
  for (let b = 1; b <= block; b++) {
    const last = order[order.length - 1];
    order = blockOrder(planetSeed, b);
    if (order[0] === last)
      [order[0], order[1]] = [order[1] as SpacePlanetId, order[0] as SpacePlanetId];
  }
  return order[turn % SPACE_PLANET_IDS.length] as SpacePlanetId;
}

/** How the planet of a lap crosses the screen: its side (0 left, 1 right; alternates lap by lap) and a draw 0..1 for its entry height. */
export interface PlanetPass {
  side: 0 | 1;
  enter: number;
}

export function planetPassOf(planetSeed: number, lap: number): PlanetPass {
  const turn = Math.max(lap, 1) - 1;
  const first = new Rng(planetSeed).fork('side').int(0, 1);
  return {
    side: ((first + turn) % 2) as 0 | 1,
    enter: new Rng(planetSeed).fork(`enter${turn}`).next(),
  };
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

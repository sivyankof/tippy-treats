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

/** Whether a planet fits on a lap (the corridor of the lap leaves it a lane); decided by the caller. */
export type PlanetFits = (id: SpacePlanetId, lap: number) => boolean;

/**
 * The dessert planet of a lap of Space, or `null` when no planet fits that lap. The laps walk the seeded order of
 * a block of nine planets (`blockOrder`): each lap takes the first planet of the order that has not been shown yet
 * and fits the lap (`fits`); a planet that does not fit waits for a later, narrower lap. A block is over when all
 * nine have been shown, then the next block begins with a new order (its first pick is not the planet just shown).
 * So no planet repeats before all nine were shown, and a lap has no planet only when nothing fits it. If only
 * planets already shown fit a lap, the first of them in the order is taken (a rare repeat is better than an empty
 * lap). Lap 0 or less counts as lap 1. Pure: the result depends on the seed, the lap and `fits` alone.
 */
export function planetOfLap(
  planetSeed: number,
  lap: number,
  fits: PlanetFits,
): SpacePlanetId | null {
  const last = Math.max(lap, 1);
  let block = 0;
  let order = blockOrder(planetSeed, block);
  let shown = new Set<SpacePlanetId>();
  let previous: SpacePlanetId | null = null;
  let pick: SpacePlanetId | null = null;
  for (let at = 1; at <= last; at++) {
    const fitting = order.filter((id) => fits(id, at));
    const fresh = fitting.filter((id) => !shown.has(id));
    const pool = fresh.length > 0 ? fresh : fitting;
    pick = pool.find((id) => id !== previous) ?? pool[0] ?? null;
    if (pick === null) continue;
    previous = pick;
    shown.add(pick);
    if (shown.size === SPACE_PLANET_IDS.length) {
      shown = new Set();
      order = blockOrder(planetSeed, ++block);
    }
  }
  return pick;
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

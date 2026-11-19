import { SPACE_PLANET_IDS, type SpacePlanetId } from '../../data/zones/space-planets';
import { Rng } from '../common/rng';

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

/** Whether a planet fits a lap whole (the lane beside the corridor has room for it); decided by the caller. */
export type PlanetFits = (id: SpacePlanetId, lap: number) => boolean;

/**
 * The dessert planet of a lap of Space. The laps walk the seeded order of a block of nine planets (`blockOrder`):
 * each lap takes the first planet of the order that has not been shown yet and fits the lap whole (`fits`); while
 * one fits, a planet that does not waits for a later, narrower lap. When none of the planets not yet shown fits
 * (or only the one just shown does),
 * the first of them in the order is taken all the same (its caller places it by a fallback rule), so every lap has
 * a planet. A block is over when all nine have been shown, then the next block begins with a new order (its first
 * pick is not the planet just shown). So no planet repeats before all nine were shown. Lap 0 or less counts as
 * lap 1. Pure: the result depends on the seed, the lap and `fits` alone.
 */
export function planetOfLap(planetSeed: number, lap: number, fits: PlanetFits): SpacePlanetId {
  return new PlanetWalk(planetSeed, fits).pick(lap);
}

/**
 * The walk behind `planetOfLap`, kept between calls: it remembers the pick of every lap it has passed, so asking
 * for the next lap costs one step, not a replay from lap 1. `fits` must stay the same for the life of a walk.
 */
export class PlanetWalk {
  private readonly picks: SpacePlanetId[] = [];
  private block = 0;
  private order: SpacePlanetId[];
  private shown = new Set<SpacePlanetId>();
  private previous: SpacePlanetId | null = null;

  constructor(
    private readonly planetSeed: number,
    private readonly fits: PlanetFits,
  ) {
    this.order = blockOrder(planetSeed, 0);
  }

  pick(lap: number): SpacePlanetId {
    const last = Math.max(lap, 1);
    while (this.picks.length < last) this.step(this.picks.length + 1);
    return this.picks[last - 1] ?? this.order[0]!;
  }

  private step(at: number): void {
    const fresh = this.order.filter((id) => !this.shown.has(id));
    const fitting = fresh.filter((id) => this.fits(id, at));
    const notPrevious = (id: SpacePlanetId): boolean => id !== this.previous;
    // A block holds nine, and `shown` is reset as the ninth is shown: `fresh` is never empty. When the only
    // fitting planet is the one just shown (a new block begins with it), the fallback rule takes the first
    // fresh one that is not, as when nothing fits.
    const pick = fitting.find(notPrevious) ?? fresh.find(notPrevious) ?? fresh[0] ?? this.order[0]!;
    this.picks.push(pick);
    this.previous = pick;
    this.shown.add(pick);
    if (this.shown.size === SPACE_PLANET_IDS.length) {
      this.shown = new Set();
      this.order = blockOrder(this.planetSeed, ++this.block);
    }
  }
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

import {
  SPACE_VISITOR,
  SPACE_VISITOR_IDS,
  type SpaceVisitorId,
} from '../data/guests/space-visitor';
import { Rng } from './rng';

/**
 * The stream that decides the guests of Space (cosmetic). It is forked from the planet seed of the run
 * (`planetSeedOf`, not the run seed itself) under its own name, so it is apart from the run's stream and
 * from the planets' draws alike.
 */
export function visitorSeedOf(seed: number): number {
  return new Rng(seed).fork('visitors').seed;
}

/** The guest whose share of the total weight of `ids` `roll` (0..1) falls into. */
export function pickGuest(
  roll: number,
  ids: readonly SpaceVisitorId[] = SPACE_VISITOR_IDS,
): SpaceVisitorId {
  const total = ids.reduce((sum, id) => sum + SPACE_VISITOR.guests[id].weight, 0);
  let left = roll * total;
  for (const id of ids) {
    left -= SPACE_VISITOR.guests[id].weight;
    if (left < 0) return id;
  }
  return ids[ids.length - 1] as SpaceVisitorId;
}

/**
 * The guest that crosses on a lap of Space, or `null` for a lap without one. Every lap rolls
 * `chancePerLap` on its own stream; a guest is never the same as the one that crossed last (laps
 * without a guest do not count). Pure: it depends on the seed and the lap alone; the laps before
 * are replayed (a handful of draws).
 */
export function visitorOfLap(visitorSeed: number, lap: number): SpaceVisitorId | null {
  const root = new Rng(visitorSeed);
  let last: SpaceVisitorId | null = null;
  let result: SpaceVisitorId | null = null;
  for (let n = 1; n <= Math.max(lap, 1); n++) {
    const rng = root.fork(`lap${n}`);
    result = null;
    if (rng.next() < SPACE_VISITOR.chancePerLap) {
      result = pickGuest(
        rng.next(),
        SPACE_VISITOR_IDS.filter((id) => id !== last),
      );
      last = result;
    }
  }
  return result;
}

/** The random stream that rolls the details (delay, length, side, height) of the pass of a lap. */
export function visitorPassRng(visitorSeed: number, lap: number): Rng {
  return new Rng(visitorSeed).fork(`pass${lap}`);
}

import { OVEN } from '../../data/progression/progression';
import { isNewDay, usedToday, type DayCounter } from '../progression/day-count';

/**
 * The "fresh oven" of the baker XP (docs/04-meta-retention.md, section 1): the first
 * `OVEN.freshLayers` layers of a local day pay 1 XP each, later layers 1 XP per `OVEN.layersPerXp`.
 */
export interface OvenState extends DayCounter {
  /** Layers beyond the fresh ones that did not make a whole XP yet; kept across days, never lost. */
  carry: number;
}

/** Fresh layers still left today. */
export function freshLeft(oven: OvenState, today: string, clockBack: boolean): number {
  return Math.max(0, OVEN.freshLayers - usedToday(oven, today, clockBack));
}

export interface OvenResult {
  oven: OvenState;
  xp: number;
  /** Fresh layers left before and after the run. */
  before: number;
  after: number;
}

/** XP of a run of `layers` layers on `today`, and the oven after it. */
export function bakeLayers(
  oven: OvenState,
  layers: number,
  today: string,
  clockBack: boolean,
): OvenResult {
  const placed = Math.max(0, Math.floor(layers));
  const newDay = isNewDay(oven.day, today, clockBack);
  const used = newDay ? 0 : oven.used;
  const day = newDay ? today : oven.day;
  const before = Math.max(0, OVEN.freshLayers - used);
  const fresh = Math.min(placed, before);
  const pool = oven.carry + (placed - fresh);
  return {
    oven: { day, used: used + fresh, carry: pool % OVEN.layersPerXp },
    xp: fresh + Math.floor(pool / OVEN.layersPerXp),
    before,
    after: before - fresh,
  };
}

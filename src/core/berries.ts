import { BALANCE } from '../data/balance';
import type { SimEvent } from './tower-sim';

/**
 * Berries the events of one sim step earn: a perfect landing on a golden layer. Every event is
 * reported by the sim exactly once, so crediting this per step counts each berry once, whatever
 * restarts or continues follow.
 */
export function berriesFromEvents(events: readonly SimEvent[]): number {
  let total = 0;
  for (const event of events) {
    if (event.type === 'golden' && event.perfect) total += BALANCE.golden.perfectBerries;
  }
  return total;
}

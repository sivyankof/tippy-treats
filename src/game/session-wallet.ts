import type { SimEvent } from '../core/tower-sim';
import { BALANCE } from '../data/balance';

/**
 * Berries of this browser session, kept in memory (saving arrives with the save system, M6).
 * Berries are added the moment a run earns them (see `berriesFromEvents`), so they can pay for
 * the continue of the same run; a continue spends them. Whatever the outcome of a run, they stay.
 */
export class SessionWallet {
  private amount = 0;

  get berries(): number {
    return this.amount;
  }

  /** Adds whole berries; zero, negative and NaN amounts are ignored, fractions are floored. */
  add(berries: number): void {
    const whole = Math.floor(berries);
    if (whole > 0) this.amount += whole;
  }

  canAfford(cost: number): boolean {
    return cost >= 0 && this.amount >= cost;
  }

  /** Takes `cost` berries; false (and nothing taken) when there are not enough. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.amount -= cost;
    return true;
  }
}

/** The wallet of the running session. */
export const sessionWallet = new SessionWallet();

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

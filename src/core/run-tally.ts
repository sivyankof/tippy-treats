import type { CoinSource, SimEvent } from './sim-types';

/** What a run collected, for the breakdown on the results screen. */
export interface RunTally {
  coins: Record<CoinSource, number>;
  /** Abilities that went off during the run. */
  abilities: number;
  /** Highest wobble the tower reached during the run. */
  maxWobble: number;
}

export function emptyTally(): RunTally {
  return {
    coins: { floating: 0, combo: 0, perfect: 0, crumb: 0, golden: 0, height: 0 },
    abilities: 0,
    maxWobble: 0,
  };
}

/** Adds the coin and ability events of one step; `tally` is changed in place. */
export function tallyEvents(tally: RunTally, events: readonly SimEvent[]): void {
  for (const event of events) {
    if (event.type === 'coin_collect') tally.coins[event.source] += event.amount;
    else if (event.type === 'ability') tally.abilities += 1;
  }
}

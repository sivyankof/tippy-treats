import { heightBonusCoins } from '../src/core/coins';
import type { CoinSource, SimEvent, TowerState } from '../src/core/sim-types';
import type { RunObserver } from './run-observer';

/** Every coin source the sim pays; the order is the order of the report columns. */
export const COIN_SOURCES: readonly CoinSource[] = [
  'floating',
  'combo',
  'golden',
  'height',
  'perfect',
  'crumb',
];

export type CoinsBySource = Record<CoinSource, number>;

export function emptyCoins(): CoinsBySource {
  return { floating: 0, combo: 0, golden: 0, height: 0, perfect: 0, crumb: 0 };
}

/** Coins of every run by source, filled from the `coin_collect` events. */
export class CoinStats implements RunObserver {
  /** One entry per finished run, in play order. */
  readonly runs: CoinsBySource[] = [];
  /** Runs cut off at the height limit; their height bonus is added as if the run had ended there. */
  censored = 0;
  private current = emptyCoins();

  noteCensored(state: Readonly<TowerState>): void {
    this.censored += 1;
    this.current.height += heightBonusCoins(state.height);
    this.runs.push(this.current);
    this.current = emptyCoins();
  }

  noteEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'coin_collect') this.current[event.source] += event.amount;
      if (event.type === 'run_over') {
        this.runs.push(this.current);
        this.current = emptyCoins();
      }
    }
  }
}

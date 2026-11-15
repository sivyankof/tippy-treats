import { heightBonusCoins } from '../src/core/coins';
import { emptyTally, tallyEvents, type RunTally } from '../src/core/run-tally';
import type { CoinSource, SimEvent, TowerState } from '../src/core/sim-types';
import type { RunObserver } from './run-observer';

export type CoinsBySource = RunTally['coins'];

/** Every coin source the sim pays, in the order of the core tally (the order of the report columns). */
export const COIN_SOURCES = Object.keys(emptyTally().coins) as CoinSource[];

/** Coins of every run by source, filled with the core run tally. */
export class CoinStats implements RunObserver {
  /** One entry per finished run, in play order. */
  readonly runs: CoinsBySource[] = [];
  /** Runs cut off at the height limit; their height bonus is added as if the run had ended there. */
  censored = 0;
  private current = emptyTally();

  noteCensored(state: Readonly<TowerState>): void {
    this.censored += 1;
    this.current.coins.height += heightBonusCoins(state.height);
    this.finishRun();
  }

  noteEvents(events: readonly SimEvent[]): void {
    tallyEvents(this.current, events);
    if (events.some((event) => event.type === 'run_over')) this.finishRun();
  }

  private finishRun(): void {
    this.runs.push(this.current.coins);
    this.current = emptyTally();
  }
}

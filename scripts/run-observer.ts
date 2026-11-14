import type { SimEvent, TowerState } from '../src/core/sim-types';

/** Something that watches bot runs in `npm run sim` without changing them. */
export interface RunObserver {
  /** Right before every sim step. */
  beforeStep?(state: Readonly<TowerState>): void;
  /** The events of a step (the decline of a continue offer included). */
  noteEvents?(events: readonly SimEvent[], state: Readonly<TowerState>): void;
  /** Right before the bot taps. */
  noteDrop?(state: Readonly<TowerState>): void;
}

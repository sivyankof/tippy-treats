import { isEmptyRun, type RunResult } from '../core/run-result';
import type { RunTally } from '../core/run-tally';
import type { RunExtras, RunSummary } from '../state/game-state';

/** The part of the save a run goes into. */
export interface RunSink {
  recordRun(result: RunResult, startHeight: number, extras?: RunExtras): RunSummary;
}

/** The part of the simulation a quit needs. */
export interface QuitSource {
  quitResult(): RunResult | null;
}

/** Reads the run counters the result does not carry at the moment of recording. */
export type ExtrasSource = () => RunExtras;

/** The counters of the run tally that the missions need. */
export function extrasOf(tally: RunTally): RunExtras {
  return {
    floatingCoins: tally.coins.floating,
    abilities: tally.abilities,
    maxWobble: tally.maxWobble,
  };
}

/** Puts one run into the save, once, whether it ended by itself or the player left it. */
export class RunRecorder {
  private recorded: RunSummary | null = null;

  constructor(
    private readonly sink: RunSink,
    private readonly startHeight: number,
    /** False for artificial dev runs (`?bot=`, `?start=`): they never reach the save. */
    private readonly enabled = true,
    private readonly extras?: ExtrasSource,
  ) {}

  /** What the run changed in the save; `null` until it is recorded. */
  get summary(): RunSummary | null {
    return this.recorded;
  }

  /** The `run_over` result of the simulation. */
  recordOver(result: RunResult): void {
    if (this.recorded || !this.enabled) return;
    this.recorded = this.sink.recordRun(result, this.startHeight, this.extras?.());
  }

  /** The player left a running run: its coins and berries stay with them. A run that earned nothing is not counted. */
  recordQuit(sim: QuitSource): void {
    if (this.recorded || !this.enabled) return;
    const result = sim.quitResult();
    if (!result || isEmptyRun(result, this.startHeight)) return;
    this.recorded = this.sink.recordRun(result, this.startHeight, this.extras?.());
  }
}

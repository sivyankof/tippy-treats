import { isEmptyRun, type RunResult } from '../core/run-result';
import type { RunSummary } from '../state/game-state';

/** The part of the save a run goes into. */
export interface RunSink {
  recordRun(result: RunResult, startHeight: number): RunSummary;
}

/** The part of the simulation a quit needs. */
export interface QuitSource {
  quitResult(): RunResult | null;
}

/** Puts one run into the save, once, whether it ended by itself or the player left it. */
export class RunRecorder {
  private recorded: RunSummary | null = null;

  constructor(
    private readonly sink: RunSink,
    private readonly startHeight: number,
    /** False for artificial dev runs (`?bot=`, `?start=`): they never reach the save. */
    private readonly enabled = true,
  ) {}

  /** What the run changed in the save; `null` until it is recorded. */
  get summary(): RunSummary | null {
    return this.recorded;
  }

  /** The `run_over` result of the simulation. */
  recordOver(result: RunResult): void {
    if (this.recorded || !this.enabled) return;
    this.recorded = this.sink.recordRun(result, this.startHeight);
  }

  /** The player left a running run: its coins and berries stay with them. A run that earned nothing is not counted. */
  recordQuit(sim: QuitSource): void {
    if (this.recorded || !this.enabled) return;
    const result = sim.quitResult();
    if (!result || isEmptyRun(result, this.startHeight)) return;
    this.recorded = this.sink.recordRun(result, this.startHeight);
  }
}

import { isEmptyRun, type RunResult } from '../../core/run/run-result';
import type { SimEvent } from '../../core/tower/tower-sim';
import type { RunTally } from '../../core/run/run-tally';
import type { RunExtras, RunSummary } from '../../state/game-state';
import { NO_EXTRAS } from '../../state/run-progress';

/** The part of the save a run goes into. */
export interface RunSink {
  recordRun(result: RunResult, startHeight: number, extras?: RunExtras): RunSummary;
  /** Keeps the running run beside the save while the app is in the background. */
  keepRunDraft(result: RunResult, startHeight: number, extras: RunExtras): Promise<void>;
  dropRunDraft(): Promise<void>;
}

/** The part of the simulation a quit needs. */
export interface QuitSource {
  quitResult(): RunResult | null;
}

/** Something that tells when the app goes to the background and comes back (`game.events`). */
interface VisibilityEvents {
  on(event: string, fn: () => void): unknown;
  off(event: string, fn: () => void): unknown;
}

/**
 * Keeps the draft of the run while the app is in the background (`hidden`) and drops it when the
 * app is back with the run alive (`visible`); returns the unsubscribe.
 */
export function bindRunDraft(
  events: VisibilityEvents,
  names: { hidden: string; visible: string },
  recorder: () => RunRecorder,
  sim: () => QuitSource,
): () => void {
  const keep = (): void => recorder().keepDraft(sim());
  const drop = (): void => recorder().dropDraft();
  events.on(names.hidden, keep);
  events.on(names.visible, drop);
  return () => {
    events.off(names.hidden, keep);
    events.off(names.visible, drop);
  };
}

/** Reads the run counters the result does not carry at the moment of recording. */
export type ExtrasSource = () => RunExtras;

/** The counters of the run tally that the missions and the baker's journal need. */
export function extrasOf(tally: RunTally): RunExtras {
  return {
    floatingCoins: tally.coins.floating,
    abilities: tally.abilities,
    maxWobble: tally.maxWobble,
    flies: tally.flies,
    coinSources: { ...tally.coins },
  };
}

/**
 * Puts one run into the save, once, whether it ended by itself or the player left it. While the
 * app is in the background the run lies beside the save as a draft (docs/08, section 5).
 */
export class RunRecorder {
  private recorded: RunSummary | null = null;
  /** A draft of this run is in the storage. */
  private drafted = false;

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

  /** The run is over when the step reports `run_over`: its coins, XP and record go into the save, once. */
  recordFinished(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'run_over') {
        this.recordOver(event.result);
        return;
      }
    }
  }

  /** The `run_over` result of the simulation. */
  recordOver(result: RunResult): void {
    if (this.recorded || !this.enabled) return;
    this.recorded = this.sink.recordRun(result, this.startHeight, this.extras?.());
  }

  /**
   * The app went to the background mid-run: the run as a quit goes beside the save, so an unload
   * there loses nothing. A run that earned nothing removes an earlier draft instead.
   */
  keepDraft(sim: QuitSource): void {
    if (this.recorded || !this.enabled) return;
    const result = sim.quitResult();
    if (!result || isEmptyRun(result, this.startHeight)) {
      this.dropDraft();
      return;
    }
    this.drafted = true;
    void this.sink.keepRunDraft(result, this.startHeight, this.extras?.() ?? NO_EXTRAS);
  }

  /** The app is back with the run alive: the draft goes and the run goes on. */
  dropDraft(): void {
    if (!this.drafted) return;
    this.drafted = false;
    void this.sink.dropRunDraft();
  }

  /** The player left a running run: its coins and berries stay with them. A run that earned nothing is not counted. */
  recordQuit(sim: QuitSource): void {
    if (this.recorded || !this.enabled) return;
    const result = sim.quitResult();
    if (!result || isEmptyRun(result, this.startHeight)) return;
    this.recorded = this.sink.recordRun(result, this.startHeight, this.extras?.());
  }
}

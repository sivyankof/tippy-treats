import type { CheckpointHeight } from '../core/zones/checkpoints';
import type { RunResult } from '../core/run/run-result';
import type { RunTally } from '../core/run/run-tally';
import { EMPTY_SUMMARY, type GameState } from '../state/game-state';
import type { TowerSnapshot } from './objects/tower-snapshot';
import type { RunRecorder } from './run-recorder';
import type { ResultsData } from './scene-keys';

/** What the run left behind for the results screen. */
export interface RunOutcome {
  result: RunResult;
  recorder: RunRecorder;
  tally: RunTally;
  /** The run reached the save (false for dev bot and start-height runs). */
  recorded: boolean;
  tower: TowerSnapshot;
  /** Height the run began from, and the checkpoint the player chose (null: the zero start). */
  startHeight: number;
  checkpoint: CheckpointHeight | null;
}

/**
 * Whether the results show the "debug run, not saved" plate: only in the dev build, and only
 * for a run that did not reach the save (`?bot=`, `?start=`, `?team=`, `?level=`; see `savesRun`).
 */
export function isDebugRun(recorded: boolean, dev: boolean): boolean {
  return dev && !recorded;
}

/** The run reached the save for real: only such a run may double coins, show ads, share or start paid runs. */
export function isLiveRun(data: Pick<ResultsData, 'recorded' | 'benchmark'>): boolean {
  return data.recorded && data.benchmark !== true;
}

/**
 * Bundles a finished run for the results scene. A run that did not reach the save (dev bot,
 * start height) keeps the experience bar where it is.
 */
export function buildResultsData(outcome: RunOutcome, save: GameState): ResultsData {
  const { bakerLevel: level, bakerXp: xp } = save.data;
  const summary = outcome.recorder.summary ?? { ...EMPTY_SUMMARY, before: { level, xp } };
  const { result, tally, recorded, tower } = outcome;
  const { startHeight, checkpoint } = outcome;
  return { result, summary, tally, recorded, tower, startHeight, checkpoint };
}

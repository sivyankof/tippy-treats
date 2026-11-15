import type { RunResult } from '../core/run-result';
import type { RunTally } from '../core/run-tally';
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
}

/**
 * Bundles a finished run for the results scene. A run that did not reach the save (dev bot,
 * start height) keeps the experience bar where it is.
 */
export function buildResultsData(outcome: RunOutcome, save: GameState): ResultsData {
  const { bakerLevel: level, bakerXp: xp } = save.data;
  const summary = outcome.recorder.summary ?? { ...EMPTY_SUMMARY, before: { level, xp } };
  const { result, tally, recorded, tower } = outcome;
  return { result, summary, tally, recorded, tower };
}

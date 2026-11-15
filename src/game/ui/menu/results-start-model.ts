import type { CheckpointHeight, CheckpointRow } from '../../../core/checkpoints';
import type { CheckpointPayResult } from '../../checkpoint-start';
import { buttonsFor, type CheckpointButtons } from './checkpoint-model';

/** What the results offer besides "Play again" (which always starts from zero for free). */
export type ResultsStartPlan =
  | { kind: 'none' }
  /** After a checkpoint run: the same start again, for berries and, for a low one, for an ad. */
  | {
      kind: 'again';
      height: CheckpointHeight;
      main: Extract<CheckpointButtons['main'], { kind: 'pay' }>;
      ad: CheckpointButtons['ad'];
      /** Today's ad starts are used up: a caption under the price instead of the ad button. */
      adSpent: boolean;
    }
  /** After a zero start with some checkpoint open: a button that opens the "Where from?" window. */
  | { kind: 'choose' };

export interface ResultsStartInput {
  daily: boolean;
  /** The tutorial run. */
  firstRun: boolean;
  /** The run reached the save (not a bot or debug run). */
  recorded: boolean;
  /** The checkpoint the run began from, null for a zero start. */
  checkpoint: CheckpointHeight | null;
  /** Opened checkpoints now (the run just finished may have opened more). */
  opened: readonly CheckpointHeight[];
  /** Rows of the "Where from?" window for the current wallet and ad state. */
  rows: readonly CheckpointRow[];
}

/** Which start buttons the results of a run show. */
export function resultsStartPlan(input: ResultsStartInput): ResultsStartPlan {
  if (input.daily || input.firstRun || !input.recorded) return { kind: 'none' };
  if (input.checkpoint === null) {
    return input.opened.length > 0 ? { kind: 'choose' } : { kind: 'none' };
  }
  const row = input.rows.find((candidate) => candidate.height === input.checkpoint);
  if (!row || row.locked) return { kind: 'none' };
  const wanted = buttonsFor(row);
  if (wanted.main.kind !== 'pay') return { kind: 'none' };
  return {
    kind: 'again',
    height: input.checkpoint,
    main: wanted.main,
    ad: wanted.ad,
    adSpent: wanted.adSpent,
  };
}

/**
 * Whether the ad button of the results looks unavailable after a tap. A grey button stays
 * tappable (the payment looks at the ad again), so an ad that has loaded since lights it up; a
 * tap that did nothing because another payment was going leaves it as it was.
 */
export function adGreyAfter(result: CheckpointPayResult, wasGrey: boolean): boolean {
  if (result === 'unavailable' || result === 'refused') return true;
  return result === 'busy' ? wasGrey : false;
}

/** Numbers of the "Started at layer N · placed M" line; the layers below the start were not placed. */
export function startedLine(
  startHeight: number,
  height: number,
): { start: number; placed: number } {
  return { start: startHeight, placed: Math.max(0, Math.floor(height) - startHeight) };
}

import { CLASSIC_RUN, type RunRequest } from './run-request';

/** What a restart of the current run turns into. */
export type RestartDecision = 'run' | 'daily-screen';

/**
 * The request a restart begins with: a run that was paid to start from a checkpoint restarts from
 * zero (the payment bought that one run), every other run restarts as it was.
 */
export function restartRequest(request: RunRequest): RunRequest {
  return request.kind === 'classic' && request.checkpoint !== undefined ? CLASSIC_RUN : request;
}

/**
 * Decides whether a restart may begin a new run. A daily run spends an attempt first (as the
 * "Play" button of the daily screen does); with none left the daily screen opens instead.
 * Classic and demo runs cost nothing.
 */
export function decideRestart(request: RunRequest, spendAttempt: () => boolean): RestartDecision {
  if (request.kind !== 'daily') return 'run';
  return spendAttempt() ? 'run' : 'daily-screen';
}

// The first runs without sales (docs/05-economy-monetization.md, section 5).
import { FIRST_RUNS } from '../data/economy/first-runs';

/**
 * The run that comes after `runsBefore` finished runs is a clean one: no "Continue?" window
 * after a miss and no "×2 coins" on its results.
 */
export function isCleanRun(runsBefore: number): boolean {
  return runsBefore < FIRST_RUNS.clean;
}

/** Enough runs are finished for the starter pack on Home and for interstitials. */
export function pastQuietRuns(runsFinished: number): boolean {
  return runsFinished >= FIRST_RUNS.quiet;
}

import { services } from '../services';
import type { EventParams } from '../services/telemetry/types';
import type { RunSetup } from './run-setup';

/** Parameters of `run_start`: the mode, the team ids (empty slots skipped), the run number and the start height. */
export function runStartParams(setup: RunSetup, runsBefore: number): EventParams {
  return {
    mode: setup.mode,
    team: setup.team.flatMap((slot) => (slot ? [slot.id] : [])).join(','),
    run_index: runsBefore + 1,
    start_height: setup.startHeight,
  };
}

/**
 * Logs the start of a run that will reach the save (not the creature demo, a bot or a dev start).
 * `runsBefore`: finished runs in the save.
 */
export function logRunStart(setup: RunSetup, runsBefore: number): void {
  if (!setup.writesSave) return;
  services.telemetry.logEvent('run_start', runStartParams(setup, runsBefore));
}

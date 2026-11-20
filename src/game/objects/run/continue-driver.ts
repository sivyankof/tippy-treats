import type { RunMode } from '../../../core/run/run-result';
import type { SimEvent, TowerSim } from '../../../core/tower/tower-sim';
import { services } from '../../../services';
import type { ContinueFlow } from '../../run/continue-flow';
import { cuesForMoment } from '../../fx/audio/moment-cues';
import { playCues } from '../../fx/audio/run-cues';

export interface ContinueDriveContext {
  flow: ContinueFlow | null;
  sim: TowerSim;
  mode: RunMode;
  /** The run ends without the "Continue?" window (bot, demo). */
  noContinue: boolean;
  /** The miss has played out far enough to ask the player. */
  canDecline: boolean;
}

/**
 * After the miss has played: opens the "Continue?" offer, or ends the run when no window must
 * show (and always under a bot, which has nobody to press the buttons). Then runs the offer.
 */
export function driveContinue(ctx: ContinueDriveContext, delta: number, events: SimEvent[]): void {
  const { flow, sim } = ctx;
  if (!flow || sim.state.phase !== 'await_continue') return;
  if (!flow.isOpen) {
    if (!ctx.canDecline) return;
    const opened =
      !ctx.noContinue && flow.open(ctx.mode, sim.state.continuesUsed, sim.state.height);
    if (!opened) events.push(...sim.decline());
    return;
  }
  flow.update(delta);
  const action = flow.takeAction();
  if (action === 'continue') {
    events.push(...sim.continueRun());
    playCues(cuesForMoment('continued'), services);
  } else if (action === 'decline') {
    events.push(...sim.decline());
  }
}

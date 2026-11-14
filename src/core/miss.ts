import { BALANCE } from '../data/balance';
import type { RunConfig, SimEvent, SimPhase, TowerState } from './sim-types';

/** What the sim does after a miss. */
export interface MissOutcome {
  /** Width of the next layer to spawn. */
  nextWidth: number;
  /** `pause` when the shield ate the miss, otherwise the continue offer or the end of the run. */
  next: Extract<SimPhase, 'pause' | 'await_continue' | 'over'>;
}

/**
 * Applies a miss: breaks the combo, lets the brownie shield eat it, or decides between the
 * continue offer and the end of the run. Pushes the `miss` event; the caller enters the phase.
 * `shielded` is the shield of the landing the miss belongs to (a sneeze passes its own).
 */
export function applyMiss(
  s: TowerState,
  events: SimEvent[],
  mode: RunConfig['mode'],
  nextWidth: number,
  shielded: boolean,
): MissOutcome {
  s.combo = 0;
  if (shielded) {
    // The shield eats the miss: the run goes on and the same layer (drop miss) comes back,
    // or the narrow layer stays and the next one is restored (sneeze miss). Either way the
    // next layer is at least `shieldRestoreWidth` wide.
    s.shield = 0;
    events.push({ type: 'miss', shielded: true });
    return { nextWidth: Math.max(nextWidth, BALANCE.team.shieldRestoreWidth), next: 'pause' };
  }
  events.push({ type: 'miss', shielded: false });
  const canContinue = mode === 'classic' && s.continuesUsed < BALANCE.continues.max;
  return { nextWidth, next: canContinue ? 'await_continue' : 'over' };
}

/** Accepts a continue: the missed layer comes back no narrower than the restore width. */
export function applyContinue(s: TowerState, nextWidth: number): number {
  s.continuesUsed += 1;
  s.wobble = 0;
  return Math.max(nextWidth, BALANCE.continues.restoreWidth);
}

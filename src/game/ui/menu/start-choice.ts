import type * as Phaser from 'phaser';
import type { CheckpointHeight, CheckpointMethod } from '../../../core/checkpoints';
import { services } from '../../../services';
import { gameState } from '../../../state';
import {
  logCheckpointOffer,
  payForCheckpoint,
  type CheckpointPayResult,
} from '../../checkpoint-start';
import { CLASSIC_RUN, checkpointRun, type RunRequest } from '../../run-request';
import { openCheckpointWindow, type CheckpointWindow } from './checkpoint-window';

/** Starts the run of `request` through the way the calling screen already leaves by. */
export type StartRun = (request: RunRequest) => void;

/**
 * Pays for a start from `height` and, once it is paid, starts that run. Nothing is spent when the
 * result is not `paid` (too few berries, the ad was not finished, no ad ready, not allowed).
 */
export async function payAndStart(
  height: CheckpointHeight,
  method: CheckpointMethod,
  start: StartRun,
): Promise<CheckpointPayResult> {
  const result = await payForCheckpoint(height, method);
  if (result === 'paid') start(checkpointRun(height));
  return result;
}

/**
 * The "Where from?" window of Home and the results: live rows and balance, the offer logged on
 * opening. The free start begins a normal run; a paid one is paid first and then begins the run
 * from its checkpoint. Both go through `start`.
 */
export function openStartChoice(scene: Phaser.Scene, start: StartRun): CheckpointWindow {
  const rows = () => gameState.checkpointRows(services.ads.isRewardedReady());
  logCheckpointOffer();
  const window: CheckpointWindow = openCheckpointWindow(scene, {
    rows: rows(),
    berries: gameState.berries,
    onChoose: async (height, method) => {
      if (method === 'free' || height === 0) {
        start(CLASSIC_RUN);
        return 'started';
      }
      const result = await payAndStart(height, method, start);
      if (result === 'paid') return 'started';
      window.refresh(rows(), gameState.berries);
      return 'stay';
    },
  });
  return window;
}

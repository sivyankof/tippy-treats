import type * as Phaser from 'phaser';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import {
  logCheckpointOffer,
  payAndStart,
  type PayGuard,
  type StartRun,
} from '../../../checkpoint-start';
import { CLASSIC_RUN } from '../../../run-request';
import { openCheckpointWindow, type CheckpointWindow } from './checkpoint-window';

/**
 * The "Where from?" window of Home and the results: live rows and balance, the offer logged on
 * opening. The free start begins a normal run; a paid one is paid first and then begins the run
 * from its checkpoint. Both go through `start`; `guard` is the calling screen's lock while paying.
 */
export function openStartChoice(
  scene: Phaser.Scene,
  start: StartRun,
  guard?: PayGuard,
): CheckpointWindow {
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
      const result = await payAndStart(height, method, start, guard);
      if (result === 'paid') return 'started';
      window.refresh(rows(), gameState.berries);
      return 'stay';
    },
  });
  return window;
}

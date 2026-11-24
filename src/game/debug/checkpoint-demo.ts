import type * as Phaser from 'phaser';
import { checkpointRows } from '../../core/zones/checkpoints';
import { services } from '../../services';
import {
  openCheckpointWindow,
  type CheckpointWindow,
} from '../ui/menu/checkpoint/checkpoint-window';

/** How long the sample start "takes", so the locked buttons can be seen. */
const CHOOSE_MS = 600;

interface Sample {
  opened: number[];
  berries: number;
  adReady: boolean;
}

/**
 * States the opener cycles through: all locked, ads ready, berries short, ad unavailable. "Ready"
 * is ready only while the ad stub is too, so its modes (loading, offline) show in the window.
 */
const SAMPLES: readonly Sample[] = [
  { opened: [], berries: 30, adReady: true },
  { opened: [20, 40, 60], berries: 30, adReady: true },
  { opened: [20, 40, 60, 80], berries: 7, adReady: true },
  { opened: [20, 40, 60], berries: 30, adReady: false },
];

let next = 0;
let current: CheckpointWindow | null = null;

/** Dev only: opens the "Where from?" window over `scene` with the next sample state. */
export function openCheckpointDemo(scene: Phaser.Scene): void {
  current?.close();
  const sample = SAMPLES[next % SAMPLES.length];
  next += 1;
  if (!sample) return;
  const rows = () =>
    checkpointRows({
      ...sample,
      adReady: sample.adReady && services.ads.isRewardedReady(),
      adsLeft: 3,
    });
  current = openCheckpointWindow(scene, {
    rows: rows(),
    liveRows: rows,
    berries: sample.berries,
    onChoose: (height, method) => {
      console.log('checkpoint window: choose', height, method);
      return new Promise((resolve) => {
        scene.time.delayedCall(CHOOSE_MS, () => resolve('stay'));
      });
    },
    onClose: () => console.log('checkpoint window: closed'),
  });
}

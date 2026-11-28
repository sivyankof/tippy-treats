import type * as Phaser from 'phaser';
import type { SaveSummary } from './cloud-summary';
import { openChoiceWindow, openFoundWindow } from '../ui/menu/cloud/cloud-windows';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const CLOUD_SAMPLE: SaveSummary = {
  bakerLevel: 12,
  record: 187,
  creatures: 9,
  coins: 123_450,
  berries: 1_280,
  savedAt: Date.now() - DAY_MS,
};
const LOCAL_SAMPLE: SaveSummary = {
  bakerLevel: 4,
  record: 45,
  creatures: 3,
  coins: 2_300,
  berries: 35,
  savedAt: Date.now() - HOUR_MS,
};

const log = (what: string) => () => console.info(`[cloud demo] ${what}`);

/** Each press opens the next window of the iCloud save: found (its "Start over" leads to the confirmation), then the choice. */
const OPENERS: ReadonlyArray<(scene: Phaser.Scene) => void> = [
  (scene) =>
    openFoundWindow(scene, CLOUD_SAMPLE, {
      restore: log('restore'),
      startOver: log('start over'),
    }),
  (scene) =>
    openChoiceWindow(scene, LOCAL_SAMPLE, CLOUD_SAMPLE, {
      keepLocal: log('keep device'),
      keepCloud: log('keep cloud'),
    }),
];

let next = 0;

/** Opens the next sample window of the iCloud save (debug panel button). */
export function openCloudDemo(scene: Phaser.Scene): void {
  OPENERS[next % OPENERS.length]?.(scene);
  next += 1;
}

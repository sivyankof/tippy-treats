import type * as Phaser from 'phaser';
import type { RunResult } from '../core/run-result';

export const SCENES = {
  boot: 'boot',
  game: 'game',
  hud: 'hud',
  results: 'results',
} as const;

/** Data handed to the results scene when it is launched. */
export interface ResultsData {
  result: RunResult;
}

/**
 * Starts a fresh run: launching a running scene restarts it. A scene cannot launch
 * itself (Phaser ignores it), so the calling scene restarts instead.
 */
export function launchRun(scene: Phaser.Scene): void {
  for (const key of [SCENES.game, SCENES.hud]) {
    if (key === scene.scene.key) scene.scene.restart();
    else scene.scene.launch(key);
  }
}

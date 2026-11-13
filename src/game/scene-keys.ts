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

/** Starts a fresh run: launching a running scene restarts it. */
export function launchRun(scene: Phaser.Scene): void {
  scene.scene.launch(SCENES.game);
  scene.scene.launch(SCENES.hud);
}

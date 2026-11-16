import type * as Phaser from 'phaser';
import { gameState } from '../state';
import { perfResultsData } from './perf/perf-session';
import { buildResultsData, type RunOutcome } from './results-data';
import type { ResultsScene } from './scenes/results-scene';
import { SCENES } from './scene-keys';

/**
 * Starts the results scene for a finished run: it builds itself hidden, a piece per frame, and
 * waits for `revealResults`; the run is already recorded, so its data is final.
 */
export function launchResults(scene: Phaser.Scene, outcome: RunOutcome, benchmark: boolean): void {
  const data = buildResultsData(outcome, gameState);
  scene.scene.launch(SCENES.results, { ...(benchmark ? perfResultsData(data) : data), hold: true });
}

/** The held results screen may appear (the collapse is over). */
export function revealResults(scene: Phaser.Scene): void {
  (scene.scene.get(SCENES.results) as ResultsScene).reveal();
}

/** A run that restarts or is left drops the screen that was built for it and not yet shown. */
export function dropHeldResults(scene: Phaser.Scene): void {
  const scenes = scene.scene;
  if (scenes.isActive(SCENES.results) && !scenes.isVisible(SCENES.results)) {
    scenes.stop(SCENES.results);
  }
}

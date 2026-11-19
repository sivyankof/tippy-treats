import type * as Phaser from 'phaser';
import { ANIM } from '../data/common/anim';
import { gameState } from '../state';
import { resultsBakeSteps } from './fx/results-prep';
import type { BakeStep } from './ui/bake-texture';
import { perfResultsData } from './perf/perf-session';
import { buildResultsData, type RunOutcome } from './results-data';
import type { ResultsScene } from './scenes/results-scene';
import { resultsPhase, SCENES } from './scene-keys';

/**
 * The results of one run: their pictures are baked a piece per frame while the layer flies, and the
 * scene is launched once, when the run is over.
 */
export class ResultsHandoff {
  private bakes: BakeStep[] = [];
  private launched = false;

  /** A new run begins: its results are not launched yet; the pictures are queued to bake. */
  begin(scene: Phaser.Scene): void {
    this.launched = false;
    this.bakes = resultsBakeSteps(scene);
  }

  /** Bakes the next picture of the results screen (one per call). */
  bakeStep(): void {
    this.bakes.shift()?.();
  }

  /** Launches the results scene (hidden) the first time it is called for the run. */
  open(scene: Phaser.Scene, outcome: RunOutcome, benchmark: boolean): void {
    if (this.launched) return;
    this.launched = true;
    launchResults(scene, outcome, benchmark);
  }
}

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
  if (resultsPhase(scene.scene) === 'held') scene.scene.stop(SCENES.results);
}

/** The results screen is fully on show: the run scene may freeze what stands behind it. */
export const RESULTS_SETTLED = 'results_settled';

/** Tells the run scene that the results screen covers it now. */
export function settleResults(scene: Phaser.Scene): void {
  scene.scene.get(SCENES.game).events.emit(RESULTS_SETTLED);
}

/** Fades the dim veil of the results in; when it is full the run scene is told the screen covers it. */
export function fadeInResultsDim(scene: Phaser.Scene, dim: Phaser.GameObjects.Rectangle): void {
  dim.setAlpha(0);
  scene.tweens.add({
    targets: dim,
    alpha: 1,
    duration: ANIM.results.fadeMs,
    onComplete: () => settleResults(scene),
  });
}

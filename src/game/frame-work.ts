import * as Phaser from 'phaser';
import { ANIM } from '../data/anim';
import { effectsMode } from './effects-mode';
import { FrameWorkStats } from './fx/frame-work-stats';

const { statsFrames, statsPercentile, statsRefreshFrames } = ANIM.fx.auto;

/** The work time (update and render) of the latest frames: the debug panel and the fps meter show it. */
export const frameWorkStats = new FrameWorkStats({
  frames: statsFrames,
  percentile: statsPercentile,
  refreshFrames: statsRefreshFrames,
});

/** Gets every frame's work time as it is measured (the `?perf=1` benchmark collects them this way). */
export type FrameWorkListener = (workMs: number, nowMs: number) => void;
let listener: FrameWorkListener | null = null;

/** Sets (or, with `null`, removes) the one listener of the frame work times. */
export function setFrameWorkListener(next: FrameWorkListener | null): void {
  listener = next;
}

/**
 * Measures the work of every frame, from the start of the game step to the end of its render
 * (CPU time: the video chip works on its own and shows up in the following frames), and feeds
 * it to the "fewer effects" mode and the stats. Also tells the mode when a scene is created and
 * when the page comes back from the background, so their first frames are not judged.
 */
export function bindFrameWork(game: Phaser.Game): void {
  let stepStartMs = 0;
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    stepStartMs = performance.now();
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const nowMs = performance.now();
    const workMs = nowMs - stepStartMs;
    frameWorkStats.add(workMs);
    effectsMode.noteFrame(workMs, nowMs);
    listener?.(workMs, nowMs);
  });
  // The scenes exist from the start; each one reports its own creation, restarts included.
  for (const scene of game.scene.scenes) {
    scene.events.on(Phaser.Scenes.Events.CREATE, () =>
      effectsMode.noteSceneLoaded(performance.now()),
    );
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) effectsMode.noteResumed(performance.now());
  });
}

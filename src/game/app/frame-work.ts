import * as Phaser from 'phaser';
import { ANIM } from '../../data/common/anim';
import { effectsMode } from './effects-mode';
import { FrameWorkStats } from '../fx/app/frame-work-stats';

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
 * it to the "fewer effects" mode and the stats. The frame's time stamp is the loop time of its
 * step (the rAF stamp), not the end of the render, so the interval between frames is the vsync
 * to vsync distance and does not move with the work time. Also tells the mode when a scene is created and
 * when the page comes back from the background, so their first frames are not judged.
 */
export function bindFrameWork(game: Phaser.Game): void {
  let stepStartMs = 0;
  let frameMs = 0;
  game.events.on(Phaser.Core.Events.PRE_STEP, (time: number) => {
    frameMs = time;
    stepStartMs = performance.now();
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const workMs = performance.now() - stepStartMs;
    frameWorkStats.add(workMs);
    effectsMode.noteFrame(workMs, frameMs);
    listener?.(workMs, frameMs);
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

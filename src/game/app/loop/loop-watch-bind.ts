import * as Phaser from 'phaser';
import { LOOP_WATCH } from '../../../data/app/loop-watch';
import { crashReporter } from '../crash-reporting';
import { LoopWatch } from './loop-watch';

/**
 * Starts the watchdog of the frame loop: one uncaught error in a scene step, a tween end or a
 * delayed call stops Phaser's loop for good (the next frame is asked for only after a good step).
 * It runs on its own timer, not in a frame, and is not behind `fxGuard`: its errors stay visible.
 * `paused`: something outside the page holds the frames on purpose (a fullscreen ad: the web view
 * under it may get no frames while the page still counts as visible). Returns the function that stops it.
 */
export function watchFrameLoop(game: Phaser.Game, paused: () => boolean = () => false): () => void {
  const watch = new LoopWatch();
  let held = false;
  const hold = (): void => {
    held = true;
  };
  const release = (): void => {
    held = false;
  };
  // Phaser's own visibility handling and the app shell (native-shell.ts) both emit these.
  game.events.on(Phaser.Core.Events.HIDDEN, hold);
  game.events.on(Phaser.Core.Events.VISIBLE, release);
  const timer = window.setInterval(() => {
    const loop = game.loop;
    const active =
      document.visibilityState === 'visible' && !held && !paused() && loop.started && loop.running;
    const verdict = watch.check(performance.now(), loop.frame, active);
    if (verdict === 'restart') {
      crashReporter.reportLoopStall('restart');
      // sleep stops the dead request chain, wake starts a new one (and takes a step at once).
      loop.sleep();
      try {
        loop.wake(true);
      } catch (error) {
        // The step itself threw again: the chain is started, the next check decides what to do.
        console.error('Frame loop restart step failed', error);
      }
    } else if (verdict === 'give-up') {
      crashReporter.reportLoopStall('give-up');
    }
  }, LOOP_WATCH.checkMs);
  return () => {
    window.clearInterval(timer);
    game.events.off(Phaser.Core.Events.HIDDEN, hold);
    game.events.off(Phaser.Core.Events.VISIBLE, release);
  };
}

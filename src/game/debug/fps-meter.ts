import * as Phaser from 'phaser';
import { FPS_METER } from '../../data/fps-meter';
import { frameWorkStats } from '../frame-work';

/**
 * A tiny frame counter in the top left corner: the frame rate and the average work time of a
 * frame in ms, numbers only. Shown with `?fps=1` in any build, so a production build can be
 * compared with the dev build on a phone.
 */
export function showFpsMeter(game: Phaser.Game): void {
  const box = document.createElement('div');
  box.style.cssText =
    `position:fixed;left:calc(env(safe-area-inset-left, 0px) + ${FPS_METER.insetPx}px);` +
    `top:calc(env(safe-area-inset-top, 0px) + ${FPS_METER.insetPx}px);z-index:${FPS_METER.zIndex};` +
    `font:${FPS_METER.fontPx}px/1 monospace;color:${FPS_METER.color};` +
    `text-shadow:${FPS_METER.shadow};pointer-events:none;`;
  document.body.appendChild(box);
  let lastMs = 0;
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const nowMs = performance.now();
    if (nowMs - lastMs < FPS_METER.refreshMs) return;
    lastMs = nowMs;
    const fps = game.loop.actualFps.toFixed(FPS_METER.fpsDecimals);
    box.textContent = `${fps} ${frameWorkStats.average.toFixed(FPS_METER.workDecimals)}`;
  });
}

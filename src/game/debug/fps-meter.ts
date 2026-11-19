import * as Phaser from 'phaser';
import { FPS_METER } from '../../data/debug/fps-meter';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { frameWorkStats } from '../app/frame-work';
import { safeBand } from '../app/safe-area';

/**
 * A tiny frame counter in the top left corner under the pause button: the frame rate and the average work time of a
 * frame in ms, numbers only. Shown with `?fps=1` in any build (dev server included), so a
 * production build can be compared with the dev build on a phone.
 */
export function showFpsMeter(game: Phaser.Game): void {
  const box = document.createElement('div');
  box.style.cssText =
    `position:fixed;z-index:${FPS_METER.zIndex};` +
    `font:${FPS_METER.fontPx}px/1 monospace;color:${FPS_METER.color};` +
    `text-shadow:${FPS_METER.shadow};pointer-events:none;`;
  document.body.appendChild(box);
  // The pause button is placed in logical pixels, so the meter follows the canvas scale.
  const place = (): void => {
    const rect = game.canvas.getBoundingClientRect();
    const scale = rect.width / game.scale.gameSize.width;
    box.style.left = `${rect.left + HUD_LAYOUT.pauseMargin * scale}px`;
    box.style.top = `${rect.top + (safeBand().top + HUD_LAYOUT.pauseMargin + HUD_LAYOUT.pauseSize) * scale + FPS_METER.insetPx}px`;
  };
  place();
  let lastMs = 0;
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const nowMs = performance.now();
    if (nowMs - lastMs < FPS_METER.refreshMs) return;
    lastMs = nowMs;
    place();
    const fps = game.loop.actualFps.toFixed(FPS_METER.fpsDecimals);
    box.textContent = `${fps} ${frameWorkStats.average.toFixed(FPS_METER.workDecimals)}`;
  });
}

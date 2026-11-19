import * as Phaser from 'phaser';
import { dropDeadFramebufferHandles, type FramebufferHandles } from './lost-context-handles';
import { asWebGLRenderer } from './webgl-renderer';

/** Keeps the lost-context warnings away: the dead handles go as soon as the context is lost. */
export function dropFramebufferHandlesOnLoss(game: Phaser.Game): void {
  const renderer = asWebGLRenderer(game.renderer);
  if (!renderer) return;
  renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => {
    dropDeadFramebufferHandles(renderer.glFramebufferWrappers as unknown as FramebufferHandles[]);
  });
}

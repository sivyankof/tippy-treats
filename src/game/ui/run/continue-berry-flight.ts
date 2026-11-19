import type * as Phaser from 'phaser';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import type { Point } from '../../fx/economy/coin-flight-math';
import { TREASURE_TEXTURES } from '../../fx/economy/treasure-textures';

const { balance: cfg } = CONTINUE_ANIM;

/**
 * `count` berries fly from `from` to `to` (coordinates of `parent`), one after another, then
 * vanish. They live inside `parent`, so they move with the window.
 */
export function flyBerries(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  from: Point,
  to: Point,
  count: number,
): void {
  const n = Math.min(count, cfg.maxFlying);
  for (let i = 0; i < n; i++) {
    const berry = scene.add
      .image(from.x, from.y, TREASURE_TEXTURES.berryFace)
      .setDisplaySize(cfg.size, cfg.size);
    parent.add(berry);
    scene.tweens.add({
      targets: berry,
      x: to.x,
      y: to.y,
      scale: berry.scale * cfg.endScale,
      delay: i * cfg.staggerMs,
      duration: cfg.flightMs,
      ease: cfg.ease,
      onComplete: () => berry.destroy(),
    });
  }
}

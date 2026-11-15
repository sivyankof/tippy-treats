import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';

/** A short side-to-side shake ("this did nothing"); the target ends at its resting x. */
export function shakeX(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
  rest: number,
): void {
  const { px, ms, repeat } = ANIM.ui.refuseShake;
  scene.tweens.killTweensOf(target);
  target.x = rest;
  scene.tweens.add({
    targets: target,
    x: rest + px,
    duration: ms,
    yoyo: true,
    repeat,
    onComplete: () => {
      target.x = rest;
    },
  });
}

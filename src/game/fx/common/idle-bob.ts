import * as Phaser from 'phaser';
import { effectsMode } from '../../app/effects-mode';

/** A slow rise and fall of a picture; `periodMs` is a whole cycle, the start is spread over `phaseSpreadMs`. */
export interface IdleBob {
  bobPx: number;
  bobPeriodMs: number;
  phaseSpreadMs: number;
}

/**
 * Makes `target` rise and fall gently for as long as it lives. Does nothing in the "fewer effects"
 * mode. The tween is removed when the object is destroyed.
 */
export function idleBob(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container | Phaser.GameObjects.Image,
  look: IdleBob,
): void {
  if (effectsMode.reduced) return;
  const tween = scene.tweens.add({
    targets: target,
    y: target.y - look.bobPx,
    duration: look.bobPeriodMs / 2,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
    delay: Phaser.Math.Between(0, look.phaseSpreadMs),
  });
  target.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}

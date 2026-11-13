import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { bump } from './anim-curves';
import { FX_TEXTURES } from './fx-textures';

/** A hidden white band of `height` for `sweepGloss`; add it to the container it runs over. */
export function createGlossBand(scene: Phaser.Scene, height: number): Phaser.GameObjects.Image {
  return new Phaser.GameObjects.Image(scene, 0, 0, FX_TEXTURES.glossBand)
    .setDisplaySize(ANIM.perfect.glossSweepWidth, height)
    .setVisible(false);
}

/**
 * Runs the band from `-travel` to `travel` (centre x, local to its container) and fades
 * it in and out on the way. `travel` must keep the band inside the surface it lights.
 */
export function sweepGloss(
  band: Phaser.GameObjects.Image,
  travel: number,
  durationMs: number,
  alpha: number,
): void {
  if (travel <= 0) return;
  const tweens = band.scene.tweens;
  tweens.killTweensOf(band);
  band.setPosition(-travel, 0).setAlpha(0).setVisible(true);
  tweens.add({
    targets: band,
    x: travel,
    duration: durationMs,
    onUpdate: (tween) => {
      band.setAlpha(alpha * bump(tween.progress));
    },
    onComplete: () => band.setVisible(false),
  });
}

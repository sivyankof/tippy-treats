import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';

/** Keys of the small shared effect textures. All are white and meant to be tinted. */
export const FX_TEXTURES = {
  glossBand: 'fx_gloss_band',
  drop: 'fx_drop',
  halo: 'fx_halo',
} as const;

/** Geometry of the baked shapes, in texture pixels. */
const GLOSS_HEIGHT = 128;
const DROP_WIDTH = ANIM.bite.dripSize;
const DROP_HEIGHT = Math.round(ANIM.bite.dripSize * 1.5);
const HALO_SIZE = 256;
/** Number of stacked circles that fake the radial falloff of the halo. */
const HALO_RINGS = 18;
/** Alpha of one ring; the centre accumulates all of them. */
const HALO_RING_ALPHA = 0.1;

/** Bakes the shared effect textures. Safe to call again: existing keys are kept. */
export function createFxTextures(scene: Phaser.Scene): void {
  const white = PALETTE.textLight;

  const bandWidth = ANIM.perfect.glossSweepWidth;
  bakeTexture(scene, FX_TEXTURES.glossBand, bandWidth, GLOSS_HEIGHT, (g) => {
    g.fillStyle(white, 1).fillRoundedRect(0, 0, bandWidth, GLOSS_HEIGHT, bandWidth / 2);
  });

  // A teardrop: round bottom, pointed top.
  const radius = DROP_WIDTH / 2;
  bakeTexture(scene, FX_TEXTURES.drop, DROP_WIDTH, DROP_HEIGHT, (g) => {
    g.fillStyle(white, 1);
    g.fillCircle(radius, DROP_HEIGHT - radius, radius);
    g.fillTriangle(radius, 0, 0, DROP_HEIGHT - radius, DROP_WIDTH, DROP_HEIGHT - radius);
  });

  const half = HALO_SIZE / 2;
  bakeTexture(scene, FX_TEXTURES.halo, HALO_SIZE, HALO_SIZE, (g) => {
    g.fillStyle(white, HALO_RING_ALPHA);
    for (let i = 0; i < HALO_RINGS; i++) {
      g.fillCircle(half, half, half * (1 - i / HALO_RINGS));
    }
  });
}

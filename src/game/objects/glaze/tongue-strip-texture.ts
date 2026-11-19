import type * as Phaser from 'phaser';
import { LICK } from '../../../data/glaze/lick';
import { PALETTE } from '../../../data/common/palette';
import { bakeTexture } from '../../ui/bake-texture';
import { TIP_BANDS, TONGUE_COLORS } from './tongue-draw';
import { stripLayout } from './tongue-strip-geometry';

/** Texture keys of the strips of the tongue. */
export const STRIP_TEXTURES = {
  /** One plain colour: the outline. */
  outline: 'lick_tongue_outline',
  /** The body and the tip: fill, light stripe, groove and the shine, all as shares of the width. */
  body: 'lick_tongue_body',
} as const;

/** The solid outline picture is this many pixels square. */
const SOLID_PX = 4;

/**
 * Bakes (once, when the run is set up) the two pictures the tongue strips are made of. Across, the
 * body picture is the whole width of the tongue (the outline is a strip of its own, wider by
 * the outline); down, a few rows of plain fill (the round root, where the stripe has not begun),
 * a band of body and then the tip, so a strip that goes on round the tip finds the stripe running
 * into it and the shine on it. The stripe and the groove are the same
 * shares of the width as when they were drawn piece by piece.
 */
export function bakeStripTextures(scene: Phaser.Scene): void {
  const layout = stripLayout();
  const { width, height, plain, band, tipHeight } = layout;
  bakeTexture(scene, STRIP_TEXTURES.outline, SOLID_PX, SOLID_PX, (g) => {
    g.fillStyle(TONGUE_COLORS.outline, 1).fillRect(0, 0, SOLID_PX, SOLID_PX);
  });
  bakeTexture(scene, STRIP_TEXTURES.body, width, height, (g) => {
    g.fillStyle(TONGUE_COLORS.fill, 1).fillRect(0, 0, width, height);
    // The stripe and the groove run on into the tip for `tipStripeShare` of its height.
    const reach = band + tipHeight * LICK.tongue.draw.tipStripeShare;
    for (const b of TIP_BANDS) {
      const w = b.width * width;
      const x = (0.5 + b.across) * width - w / 2;
      g.fillStyle(b.color, 1).fillRect(x, plain, w, reach);
    }
    const s = LICK.tongue.draw.tipShine;
    g.fillStyle(PALETTE.textLight, s.alpha).fillEllipse(
      (0.5 + s.across) * width,
      plain + band + tipHeight * s.along,
      s.w * width,
      s.h * width,
    );
  });
}

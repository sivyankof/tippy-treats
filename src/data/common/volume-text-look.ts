import { shade } from '../../util/color';
import { ANIM } from './anim';
import { PALETTE } from './palette';

/** The face colours a volume text can have. */
export type VolumeFace = 'white' | 'gold';

/**
 * The look of the large texts of a run (the 3-2-1 after a pause, the height number, the tap hint):
 * a dark contour with a hard step of shadow below (as on the ring timer and the bars), a face that
 * blends softly from its colour to a slightly deeper one at the bottom, a thin inner shade along the
 * lower right edge of each glyph and, on the gold face, a large soft gloss at the upper left. The
 * look is the same at every effects level.
 */
export const VOLUME_TEXT = {
  /** Width of the dark contour and the drop of the step below it: what the plain outlined text had. */
  contour: ANIM.hud.numberStroke,
  step: ANIM.hud.shadowOffset,
  contourColor: PALETTE.textDark,
  stepColor: shade(PALETTE.textDark, -0.35),
  /**
   * The vertical blend of the face, in shares of the ink height of the lettering from its top:
   * the face colour down to `from`, the bottom colour from `to` (below the lettering, so the
   * bottom edge only nears it).
   */
  blend: { from: 0.1, to: 1.1 },
  /**
   * The inner shade: the glyph minus itself moved by `dx`, `dy` of the font size (up and to the
   * left), so a thin crescent of the inner tone stays along the lower right edge.
   */
  innerShade: { dx: -0.02, dy: -0.03, alpha: 0.9 },
  /**
   * The gloss, an ellipse cut by the glyph: its centre `x` of the font size from the middle of the
   * glyph ink and `y` of the font size from the baseline; radii `rx`, `ry` of the font size. Faces
   * with `glossAlpha` 0 have none.
   */
  gloss: { x: -0.25, y: -0.66, rx: 0.5, ry: 0.26 },
  faces: {
    white: { color: PALETTE.textLight, bottom: 0xdfe7fb, inner: 0x9fb2e6, glossAlpha: 0 },
    gold: { color: PALETTE.gold, bottom: 0xffb52e, inner: 0xf08a1c, glossAlpha: 0.38 },
  },
} as const;

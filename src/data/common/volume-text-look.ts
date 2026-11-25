import { shade } from '../../util/color';
import { ANIM } from './anim';
import { BAR_LOOK } from './bar-look';
import { PALETTE } from './palette';

/** The face colours a volume text can have. */
export type VolumeFace = 'white' | 'gold';

/**
 * The look of the large flat texts of a run (the 3-2-1 after a pause, the height number, the tap
 * hint): the same layers as the ring timer and the bars (`BAR_LOOK`): a dark contour, a hard step
 * of shadow below, a flat darker band along the bottom of the glyphs and a short white gloss
 * stroke with a dot. Flat tones, no blur; the look is the same at every effects level.
 */
export const VOLUME_TEXT = {
  /** Width of the dark contour and the drop of the step below it: what the plain outlined text had. */
  contour: ANIM.hud.numberStroke,
  step: ANIM.hud.shadowOffset,
  contourColor: PALETTE.textDark,
  stepColor: shade(PALETTE.textDark, -0.35),
  /** The shade band takes this share of the height of the lettering, from the bottom. */
  bandShare: BAR_LOOK.shade.share,
  /**
   * The gloss stroke, measured against the ink height `H` of the lettering and the width `W` of the
   * glyph: its centre sits `x` of `W` from the left edge and `y` of `H` from the top; length, thickness,
   * the gap to the dot and the dot radius are shares of `H`; the stroke is at most `maxWidthShare` of `W`.
   */
  gloss: {
    alpha: BAR_LOOK.gloss.alpha + 0.2,
    x: 0.28,
    y: 0.2,
    length: 0.2,
    thick: 0.05,
    tiltDeg: -50,
    dotGap: 0.035,
    dotRadius: 0.03,
    maxWidthShare: 0.6,
  },
  faces: {
    white: { color: PALETTE.textLight, shade: 0xc4d0ee },
    gold: { color: PALETTE.gold, shade: shade(PALETTE.gold, BAR_LOOK.shade.amount) },
  },
} as const;

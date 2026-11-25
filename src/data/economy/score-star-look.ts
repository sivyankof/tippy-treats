import { PALETTE } from '../common/palette';

/** The star of the score tile on the results (`fx/economy/score-star-texture.ts`). */
export const SCORE_STAR = {
  /** Baked picture size, texture pixels; the star keeps `pad` of room on every side. */
  size: 96,
  pad: 6,
  /** Inner points as a share of the outer radius, and how round the points are (share of the radius). */
  inner: 0.5,
  round: 0.16,
  base: PALETTE.gold,
  shadow: 0xe8a424,
  /** The lit star is smaller by this share and pushed to the top left: the flat shadow band stays. */
  band: 0.1,
  shine: {
    x: -0.28,
    y: -0.3,
    length: 0.26,
    thick: 0.09,
    tiltDeg: -40,
    dotGap: 0.08,
    dotRadius: 0.05,
  },
  shineColor: 0xfffbe0,
  shineAlpha: 0.85,
};

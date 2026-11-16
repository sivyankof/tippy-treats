import { PALETTE } from './palette';

/**
 * The "no internet" icon on a rewarded-ad button: a pale cloud crossed by a red stroke, drawn like
 * the plain layers (flat two-tone fill, thick warm outline, stroke-and-dot highlight). Shares are of
 * the baked picture size.
 */
export const OFFLINE_LOOK = {
  /** Baked picture size in texture pixels. */
  textureSize: 64,
  colors: {
    cloud: PALETTE.panel,
    cloudShadow: 0xc9b8e6,
    slash: PALETTE.berry,
    slashShadow: 0xc41c36,
    gloss: 0xffffff,
  },
  /** Puffs of the cloud: centre and radius. */
  puffs: [
    { x: 0.3, y: 0.56, r: 0.17 },
    { x: 0.5, y: 0.42, r: 0.23 },
    { x: 0.71, y: 0.56, r: 0.17 },
  ],
  /** The flat belly of the cloud: centre, half sizes and corner radius. */
  belly: { x: 0.5, y: 0.64, rx: 0.33, ry: 0.13, radius: 0.12 },
  /** Offset of the light tone from the shadow tone (up and left). */
  bandShare: 0.04,
  /** The stroke across the cloud: end points and half thickness. */
  slash: { fromX: 0.14, fromY: 0.14, toX: 0.86, toY: 0.88, halfThick: 0.045, steps: 20 },
  gloss: {
    x: 0.36,
    y: 0.38,
    length: 0.12,
    thick: 0.05,
    tiltDeg: -35,
    dotGap: 0.03,
    dotRadius: 0.025,
  },
  glossAlpha: 0.9,
} as const;

/** How the icon sits next to the caption of a button. */
export const OFFLINE_CAPTION_LAYOUT = {
  /** Icon side as a share of the caption's own text height. */
  sizeShare: 1.3,
  /** Gap between the icon and the text, as a share of the icon side. */
  gapShare: 0.2,
} as const;

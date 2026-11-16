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
    /** Dark outline round the cloud and the stroke, so the icon holds on a grey button. */
    outline: PALETTE.textDark,
  },
  /** Thickness of that outline as a share of the picture size. */
  outlineShare: 0.055,
  /** Puffs of the cloud: centre and radius. */
  puffs: [
    { x: 0.28, y: 0.58, r: 0.19 },
    { x: 0.5, y: 0.4, r: 0.25 },
    { x: 0.72, y: 0.58, r: 0.19 },
  ],
  /** The flat belly of the cloud: centre, half sizes and corner radius. */
  belly: { x: 0.5, y: 0.66, rx: 0.36, ry: 0.14, radius: 0.13 },
  /** Offset of the light tone from the shadow tone (up and left). */
  bandShare: 0.04,
  /** The stroke across the cloud: end points and half thickness. */
  slash: { fromX: 0.12, fromY: 0.12, toX: 0.88, toY: 0.9, halfThick: 0.06, steps: 24 },
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
  /** Icon side as a share of the caption's own text height: about 70% of the button's inner height, so the stroke stays inside the plate. */
  sizeShare: 1.0,
  /** Gap between the icon and the text, as a share of the icon side. */
  gapShare: 0.2,
} as const;

/** The caption of an unavailable ad button: dark plum on a light outline, so it reads on the dimmed lavender plate. */
export const AD_UNAVAILABLE_CAPTION = {
  color: 0x24133a,
  stroke: PALETTE.panel,
} as const;

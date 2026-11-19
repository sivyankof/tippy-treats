import { PALETTE } from '../common/palette';

/**
 * The "video" icon of every button that starts a rewarded video: a round cream disc with a play
 * triangle, drawn like the plain layers (flat two-tone fill, thick warm outline, stroke-and-dot
 * highlight). Shares are of the baked picture size.
 */
export const VIDEO_ICON_LOOK = {
  /** Baked picture size in texture pixels. */
  textureSize: 64,
  colors: {
    disc: PALETTE.panel,
    discShadow: 0xc9b8e6,
    triangle: PALETTE.accentSecondary,
    triangleShadow: 0x5a3fd0,
    gloss: 0xffffff,
    outline: PALETTE.textDark,
  },
  /** Thickness of the outline as a share of the picture size. */
  outlineShare: 0.06,
  /** The disc: centre and radius. */
  disc: { x: 0.5, y: 0.5, r: 0.42 },
  /** Offset of the light tone from the shadow tone (up and left). */
  bandShare: 0.05,
  /** The triangle: left edge, right tip and half height (nudged right so it looks centred), and the outline and light tone as scales of it. */
  triangle: { left: 0.38, right: 0.72, halfHeight: 0.2, outlineScale: 1.3, lightScale: 0.72 },
  gloss: {
    x: 0.27,
    y: 0.23,
    length: 0.12,
    thick: 0.05,
    tiltDeg: -35,
    dotGap: 0.03,
    dotRadius: 0.025,
  },
  glossAlpha: 0.9,
} as const;

/** How the icon sits left of a button caption. */
export const VIDEO_CAPTION_LAYOUT = {
  /** Icon side as a share of the caption's text height. */
  sizeShare: 1.0,
  /** Gap between the icon and the text, as a share of the icon side. */
  gapShare: 0.2,
  /** Free room between the icon or the text and the edge of the button, in design pixels (13 CSS px). */
  edgePad: 40,
} as const;

import { PALETTE } from './palette';

/**
 * Look of the fresh oven drawn like the plain layers (docs/06-art-animation-audio.md, section 6): a
 * flat two-tone body, a thick outline, a dark window with a flame behind a ringed frame, a gloss
 * stroke and a small face. Sizes are in design pixels; shares are of the body height unless said otherwise.
 */
export const OVEN_LOOK = {
  size: { width: 176, height: 160 },
  /** Corner share of the half sizes, and the shadow band share. */
  round: 0.34,
  band: 0.07,
  /** Safety margin around the baked pictures, pixels. */
  texturePad: 4,
  colors: {
    lit: {
      base: 0xf08a5d,
      shadow: 0xcf6a40,
      ring: PALETTE.gold,
      ringShadow: 0xe0a21c,
      inside: 0x4a2418,
    },
    spent: {
      base: 0xbab6c4,
      shadow: 0x9b96a8,
      ring: 0x9b96a8,
      ringShadow: 0x7e7a8c,
      inside: 0x3a3646,
    },
    gloss: 0xffffff,
    face: PALETTE.textDark,
  },
  /** The round window: middle below the centre of the body, radius, ring thickness. */
  window: { y: 0.2, radius: 0.26, ring: 0.055 },
  /** The face above the window (shares of the body height from its middle). */
  face: {
    eyeY: -0.32,
    eyeSpacing: 0.4,
    eyeRadius: 0.04,
    smileY: -0.2,
    smileRadius: 0.075,
    smileSpanDeg: 110,
    smileThick: 0.032,
  },
  /** Closed eyes of the sleeping oven: half width, depth and thickness as shares of the height. */
  sleepEye: { halfWidth: 0.055, depth: 0.04, thick: 0.03 },
  gloss: {
    x: -0.4,
    y: -0.34,
    length: 0.15,
    thick: 0.04,
    tiltDeg: -55,
    dotGap: 0.05,
    dotRadius: 0.02,
    alpha: 0.9,
  },
  /** The flame behind the window: its height as a share of the window diameter, and how far it sits below the middle. */
  flame: { size: 0.85, drop: 0.06 },
  /** The ember of the spent oven: radius share of the window radius, colours. */
  ember: { radius: 0.2, drop: 0.45, color: 0xff8a3c, core: 0xffd27a },
  motion: {
    /** The living oven bobs and stretches a little. */
    bob: { rise: 5, ms: 700, stretch: 0.03 },
    /** The sleeping oven breathes slowly. */
    breath: { scaleX: 0.012, scaleY: 0.03, ms: 2400 },
    emberPulse: { alpha: 0.45, ms: 900 },
    /** The sleeping letters: size as a share of the picture height, where the first starts, and the letters' reach scale. */
    zs: { font: 0.4, x: 0.3, y: -0.42, scale: 0.35, color: 0xdcd8e6 },
  },
} as const;

import { PALETTE } from './palette';

/**
 * Pictures of rewards that are not creatures, coins or berries: the empty team slot and the little
 * daily tower (docs/06-art-animation-audio.md, "Окно нового уровня"). Sizes are texture pixels.
 */
export const REWARD_LOOK = {
  textureSize: 160,
  /** Outline thickness of the drawn pictures, pixels. */
  outline: 7,
  /** The flat shadow band: the lit shape is smaller by this share and pushed to the top left. */
  band: 0.1,
  slot: {
    base: 0xf3c999,
    shadow: 0xd9a06a,
    /** Half size of the plate as a share of the picture. */
    half: 0.4,
    radius: 0.32,
    dashes: 10,
    dashThick: 5,
    /** Dashed ring and plus, drawn in the dark tone of the plate. */
    ringShare: 0.74,
    plus: { half: 0.2, thick: 0.1, color: PALETTE.success, shadow: 0x1f9e68 },
  },
  tower: {
    /** Tiers from the bottom: half width and half height as shares of the picture, and colours. */
    tiers: [
      { x: 0, y: 0.34, rx: 0.34, ry: 0.11, base: 0xf5a9c4, shadow: 0xd9769f },
      { x: 0, y: 0.13, rx: 0.29, ry: 0.11, base: 0xc98d62, shadow: 0xa4683f },
      { x: 0, y: -0.08, rx: 0.24, ry: 0.11, base: 0xffe0a3, shadow: 0xe0b866 },
    ],
    /** The calendar sheet on top: half sizes, its head strip and the colours. */
    sheet: {
      y: -0.31,
      rx: 0.17,
      ry: 0.15,
      base: 0xffffff,
      shadow: 0xe4d8ee,
      head: PALETTE.berry,
      headShare: 0.38,
      line: 0xb7a3c9,
      lineCount: 2,
    },
  },
  /** A price chip on the picture of a creature that went to the shop: the coin sits at its corner. */
  shopCoin: { x: 0.36, y: 0.36, size: 0.42 },
  /** The sparkle of a picture appearing. */
  sparkleCount: 3,
} as const;

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
  /** The check badge of a passed tier: a green disc with a white check. */
  check: { size: 96, base: PALETTE.success, shadow: 0x1f9e68, mark: 0xffffff, markThick: 0.13 },
  /** An attempt ticket: a flat cake with a glaze cap, drips and a perforation; the used one is grey and flatter. */
  ticket: {
    width: 120,
    height: 84,
    outline: 6,
    band: 0.1,
    /** Half height of the sponge and of the glaze cap as shares of the picture height. */
    spongeRy: 0.3,
    capRy: 0.17,
    capY: -0.13,
    capInset: 0.04,
    drips: [-0.26, 0.04, 0.3],
    dripRadius: 0.075,
    /** Perforation dots: x share from the centre and dot count down the sponge. */
    perforationX: 0.2,
    perforationDots: 4,
    perforationRadius: 0.026,
    free: { cake: 0xf1c27d, cakeShadow: 0xd69f58, glaze: 0xff8fb8, glazeShadow: 0xe4659a },
    used: { cake: 0xc9c1cf, cakeShadow: 0xaaa1b3, glaze: 0xdcd6e0, glazeShadow: 0xbab2c3 },
    /** The used ticket is this much flatter and sits this much lower (shares of the picture height). */
    usedFlatten: 0.8,
    usedDrop: 0.06,
    gloss: {
      x: -0.3,
      y: -0.16,
      length: 0.2,
      thick: 0.05,
      tiltDeg: -8,
      dotGap: 0.06,
      dotRadius: 0.026,
    },
    idle: { bobPx: 3, bobPeriodMs: 3200, phaseSpreadMs: 800 },
  },
  /** The next tier to reach swells softly. */
  pulse: { scale: 1.04, periodMs: 900 },
  /** A price chip on the picture of a creature that went to the shop: the coin sits at its corner. */
  shopCoin: { x: 0.36, y: 0.36, size: 0.42 },
  /** The sparkle of a picture appearing. */
  sparkleCount: 3,
} as const;

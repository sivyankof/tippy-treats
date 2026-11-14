import { PALETTE } from './palette';

/** Style of a one-off twinkle: it stays put, spins a little, swells and fades. Same shape as `ParticleStyle`. */
const TWINKLE_STYLE = {
  speed: [0, 10],
  gravity: 0,
  drag: 0,
  spin: [-90, 90],
  scale: [0.9, 1.6],
  scaleTo: 0.1,
  alpha: 1,
  holdShare: 0.35,
  lifeMs: [380, 520],
  spreadDeg: 360,
  tiltDeg: 0,
} as const;

/** The light gold of glazes and sparkles; the base gold is `PALETTE.gold`. */
const GOLD_LIGHT = 0xffe178;

/**
 * Looks and motion of coins, berries, the coin counter and the golden layer
 * (docs/06-art-animation-audio.md, section 4, "Монеты, золотой слой").
 * Distances are logical pixels, durations milliseconds, angles degrees.
 */
export const TREASURE = {
  colors: {
    coinFace: PALETTE.gold,
    coinRim: 0xd48a10,
    coinInner: 0xffe98a,
    coinShine: 0xfffbe0,
    berry: PALETTE.berry,
    berryDark: 0xa5202f,
    berryShine: 0xffb3bd,
    leaf: PALETTE.success,
    leafDark: 0x249a68,
    /** Cake and glaze of the golden layer. */
    goldCake: 0xf0aa2c,
    goldLight: GOLD_LIGHT,
    goldGlaze: GOLD_LIGHT,
    /** Tints of the sparkles, in turn. */
    sparkle: [0xffffff, GOLD_LIGHT, PALETTE.gold],
  },
  /** Baked picture sizes, in texture pixels. */
  textures: {
    coin: 96,
    berry: 112,
    /** Alpha of the shine dots (coin and berry) and of the ring stamped on a coin. */
    shineAlpha: 0.85,
    coinRingAlpha: 0.6,
  },
  twinkle: TWINKLE_STYLE,

  /** The coin that hangs where the layer will land. */
  floating: {
    size: 84,
    haloScale: 1.9,
    haloAlpha: 0.35,
    bobAmplitude: 8,
    bobPeriodMs: 1500,
    /** Spin: the width squashes between `spinMinScale` and 1. */
    spinPeriodMs: 1200,
    spinMinScale: 0.1,
    /** Neighbouring coins spin out of step: phase (radians) per pixel of x. */
    spinPhasePerPx: 3,
    sparkleEveryMs: 1200,
    /** Sparkles appear this far from the centre, as a share of the coin size. */
    sparkleReach: 0.55,
    appearMs: 220,
    appearEase: 'Back.easeOut',
    /** A coin that was not caught swells and fades. */
    popAwayMs: 260,
    popAwayScale: 1.7,
    /** The coin hangs under the flying layer and the tower top, over the tower. */
    depthOffset: 0.5,
  },

  /** Coins flying into the counter (drawn by the HUD scene). */
  flight: {
    /** Upper cap of coin pictures for one payout; the amount is shared between them. */
    maxCoins: 6,
    staggerMs: 55,
    /** The caught coin hops up first, then flies. */
    hopMs: 150,
    hopPx: 70,
    flightMs: 450,
    arcPx: 150,
    /** Coins of one payout start this far apart (random, either way). */
    spreadPx: 44,
    size: 72,
    endScale: 0.8,
    spinPeriodMs: 480,
    spinMinScale: 0.2,
  },

  /** Coin and berry counters under the top right corner of the screen. */
  counter: {
    /** Gap between the screen edge and the icon. */
    margin: 28,
    y: 72,
    iconSize: 72,
    gap: 14,
    font: 64,
    /** The berry counter sits this far below the coin counter. */
    rowGap: 88,
    hopScale: 1.28,
    hopMs: 240,
    /** At rest the whole counter breathes and the icon turns a little. */
    breatheScale: 0.035,
    breathePeriodMs: 1900,
    /** Phase step between counter rows, radians, so two of them do not breathe in step. */
    rowPhase: 1.7,
    spinPeriodMs: 2000,
    spinMinScale: 0.78,
    glintPeriodMs: 1700,
    /** The glint sits this share of the icon size up and right of its centre. */
    glintOffset: 0.24,
    glintSpinDegPerSec: 50,
    glintScale: [0.3, 0.8],
    glintAlpha: [0.2, 1],
    revealMs: 300,
    revealEase: 'Back.easeOut',
  },

  /** A golden-layer berry: pops large in the middle of the screen, then flies to its counter. */
  berry: {
    /** Size on screen at the top of the pop, in pixels. */
    popSize: 230,
    popMs: 320,
    popEase: 'Back.easeOut',
    holdMs: 420,
    holdBobPx: 10,
    holdBobPeriodMs: 900,
    flightMs: 520,
    arcPx: 130,
    endSize: 72,
    /** The pop shows from this share of the screen height down. */
    centerY: 0.5,
    sparkles: 7,
    sparkleReach: 130,
    sparkleSpinDeg: 180,
  },

  /** The golden layer on its way and in the tower. */
  golden: {
    /** A gloss band runs over the flying layer this often. */
    glossEveryMs: 1300,
    /** The first band of a golden layer runs after this share of the period. */
    glossFirstShare: 0.4,
    /** And over the golden layers that stand in the tower. */
    towerGlossEveryMs: 2000,
    sparkles: {
      count: 6,
      scale: [0.7, 1.4],
      alpha: [0.35, 1],
      orbitPeriodMs: 2400,
      twinklePeriodMs: 700,
      /** Phase step between neighbouring sparkles, radians. */
      twinklePhaseStep: 1.7,
      spinDeg: 90,
      /** The orbit is the layer outline pushed out by this much. */
      padX: 16,
      padY: 20,
    },
    trail: {
      everyMs: 38,
      style: {
        speed: [10, 60],
        gravity: 0,
        drag: 1.6,
        spin: [-120, 120],
        scale: [0.9, 1.6],
        scaleTo: 0.2,
        alpha: 0.9,
        holdShare: 0.2,
        lifeMs: [340, 520],
        spreadDeg: 140,
        tiltDeg: 0,
      },
    },
  },
} as const;

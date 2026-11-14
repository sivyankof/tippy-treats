import { parseHex } from '../util/color';
import { ANIM } from './anim';
import { CREATURES } from './creatures';
import { PALETTE } from './palette';
import { RARITY_COLORS } from './rarity';

/** Colours the effects share, defined once. The creature ones come from the creature palettes. */
const GHOST_VIOLET = 0x8f7dff;
const ICE = 0xbfe6ff;
const ICE_PALE = 0xe6f6ff;
const LEMON = parseHex(CREATURES.lemon.palette.glaze);
const LEMON_PALE = 0xfff3a0;
const CHOCOLATE = parseHex(CREATURES.brownie.palette.body);
const CHOCOLATE_LIGHT = parseHex(CREATURES.brownie.palette.sponge);
const CHOCOLATE_CRUST = parseHex(CREATURES.brownie.palette.accent);
const CHOCOLATE_GLOW = parseHex(CREATURES.brownie.palette.detail);
const BUBBLE_CREAM = 0xfff4e4;
/** Width of the dashes of the ghost's guides: the texture and the guide are this wide. */
const GUIDE_WIDTH = 14;

/** Particle styles below have the fields of `ParticleStyle` (`game/fx/particle-motion.ts`). Soft puffs drifting up. */
const CLOUD_RISE = {
  speed: [40, 90],
  gravity: -30,
  drag: 2,
  spin: [-60, 60],
  scale: [0.6, 1.1],
  scaleTo: 1.8,
  alpha: 0.8,
  holdShare: 0.2,
  lifeMs: [450, 700],
  spreadDeg: 70,
  tiltDeg: 0,
} as const;

/** Radial sparkle: stars leave the point in every direction and fade. */
const SPARKLE = {
  speed: [120, 300],
  gravity: 120,
  drag: 2.4,
  spin: [-300, 300],
  scale: [0.5, 1],
  scaleTo: 0.2,
  alpha: 1,
  holdShare: 0.4,
  lifeMs: [450, 700],
  spreadDeg: 360,
  tiltDeg: 0,
} as const;

/**
 * Numbers of the creature abilities' animations (docs/06-art-animation-audio.md, section 4,
 * "Способности существ"). Distances are logical pixels, times milliseconds, angles degrees.
 */
export const ABILITY_ANIM = {
  /** Cap of live sprites of all ability effects. */
  maxSprites: 48,
  /** The creature layer lights up in its rarity colour. */
  flash: { alpha: 0.75, inMs: 70, outMs: 320 },
  /** Rings of an ability: the first one is a bit larger than the perfect ring. */
  ring: { scale: 1.2, boostedScale: 1.55, boostedDelayMs: 160 },
  /**
   * "Boosted!" label (world px above the layer top edge): one line above "Perfect!", so the two
   * labels do not overlap.
   */
  boostedText: {
    liftY:
      ANIM.perfect.text.liftY +
      Math.round(ANIM.perfect.text.fontSize * ANIM.perfect.text.lineGapRatio),
  },

  /** Tweens of the layer rig that the abilities use. */
  rig: { inflateRiseEase: 'Quad.easeOut', hopEase: 'Quad.easeOut', fadeEase: 'Sine.easeInOut' },
  /** Soft clouds (puff, frosty): each one swells from `startScale` of its size while it rises. */
  clouds: {
    riseEase: 'Quad.easeOut',
    /** Size variety: the size of cloud `i` steps by this much (wraps at 1). */
    sizeStep: 0.37,
    startScale: 0.4,
    startAlpha: 0.9,
    staggerMs: 40,
  },
  /** Sizes of the baked effect pictures and the bubble's colours. */
  textures: {
    strand: { width: 12, height: 64 },
    /** Width of the coat picture; a layer's coat is stretched to the layer's width. */
    coatWidth: 256,
    dash: { width: GUIDE_WIDTH, height: 256, period: 44, length: 26 },
    vignette: { width: 128, height: 228, steps: 12, stepPx: 4, alpha: 0.9 },
    /**
     * A soap bubble with a warm chocolate sheen: a faint fill, a glow that thickens towards the
     * edge, a thin light rim with a rainbow film, a crescent highlight and a spark.
     */
    bubble: {
      size: 256,
      fill: BUBBLE_CREAM,
      fillAlpha: 0.12,
      /** The edge glow: `glowSteps` rings over the outer `glowShare` of the radius, alpha up to `glowAlpha`. */
      glow: CHOCOLATE_GLOW,
      glowAlpha: 0.3,
      glowShare: 0.22,
      glowSteps: 8,
      rim: PALETTE.textLight,
      rimWidth: 4,
      rimAlpha: 0.85,
      /** Thin film colours just inside the rim, each `filmWidth` wide and `filmGap` apart. */
      film: [0xffb8dc, 0xa8e2ff],
      filmWidth: 3,
      filmGap: 5,
      filmAlpha: 0.45,
      shine: PALETTE.textLight,
      /** The crescent highlight: an arc near the upper left edge (degrees, screen y down). */
      shineAlpha: 0.75,
      shineWidth: 12,
      shineFromDeg: 195,
      shineToDeg: 245,
      shineInset: 16,
      /** A small round spark under the crescent: centre and radius as shares of the picture. */
      sparkX: 0.3,
      sparkY: 0.36,
      sparkR: 0.03,
      sparkAlpha: 0.8,
    },
  },

  honey: {
    strands: 3,
    /** Distance between strands as a share of the layer width. */
    spread: 0.28,
    length: 90,
    lifeMs: 800,
    staggerMs: 90,
    /** Thickness of a strand in pixels. */
    thickness: 12,
    joyMs: 600,
  },
  puff: {
    /** Scale of the clap: the layer swells to this and back. */
    peak: 1.15,
    startScaleY: 0.9,
    upMs: 130,
    downMs: 380,
    downEase: 'Elastic.easeOut',
    puffedMs: 600,
    clouds: 4,
    cloudScale: [0.35, 0.8],
    cloudRise: 70,
    cloudMs: 650,
    cloudColors: [PALETTE.textLight, parseHex(CREATURES.puff.palette.glaze)],
    /** The clouds start spread over this share of the layer width around the centre. */
    cloudWidthShare: 0.7,
  },
  jelly: {
    /** Wave down the tower: squash of the layer itself, its decay and delay per layer below. */
    scaleX: 1.12,
    scaleY: 0.86,
    layers: 6,
    falloff: 0.75,
    delayMs: 40,
    joyMs: 600,
    /** The sway calms smoothly: share of the gap closed per 60 Hz frame (slower than after a sneeze). */
    calmLerp: 0.06,
    /** A spring landing slides this long, with this easing, from the raw landing spot to the placed one. */
    slideMs: 520,
    slideEase: 'Elastic.easeOut',
  },
  caramel: {
    sparkles: { count: 14, style: SPARKLE },
    /** Layers of the tower below the top one that sparkle too. */
    extraLayers: 2,
    extraCount: 6,
    winkMs: 650,
    tints: [PALETTE.gold, 0xffe9a0, PALETTE.textLight],
  },
  frosty: {
    clouds: 4,
    cloudScale: [0.4, 0.9],
    cloudRise: 110,
    cloudMs: 800,
    cloudColors: [ICE_PALE, ICE],
    cloudWidthShare: 0.25,
    flakes: {
      count: 10,
      style: { ...CLOUD_RISE, speed: [90, 220], gravity: 40, scale: [0.4, 0.7] },
    },
    blowMs: 700,
    flakeColors: [PALETTE.textLight, ICE],
  },
  brownie: {
    /** Flex: squash, then a hop up. */
    squashX: 1.16,
    squashY: 0.7,
    hopPx: 34,
    hopMs: 420,
    strainMs: 650,
    chips: { count: 8, style: { ...SPARKLE, gravity: 700, speed: [150, 320], spreadDeg: 200 } },
    chipColors: [CHOCOLATE, CHOCOLATE_LIGHT],
  },
  sprinkle: {
    shot: {
      count: 26,
      style: {
        speed: [380, 820],
        gravity: 900,
        drag: 0.8,
        spin: [-540, 540],
        scale: [0.5, 0.9],
        scaleTo: 0.7,
        alpha: 1,
        holdShare: 0.6,
        lifeMs: [800, 1200],
        spreadDeg: 80,
        tiltDeg: 0,
      },
    },
    joyMs: 600,
    colors: [
      PALETTE.accent,
      PALETTE.gold,
      PALETTE.success,
      RARITY_COLORS.rare,
      PALETTE.accentSecondary,
      PALETTE.textLight,
    ],
  },
  crumb: {
    crumbs: 10,
    /** Start radius around the mouth as a share of the layer width. */
    ringShare: 0.55,
    flightMs: 520,
    staggerMs: 35,
    gapeMs: 750,
    scaleFrom: 1.1,
    scaleTo: 0.3,
    /** The ring of crumbs is this much wider than tall. */
    ringStretchX: 1.6,
    pullEase: 'Quad.easeIn',
    endAlpha: 0.2,
    /** While active: crumbs of a cut fly to the crumb layer. */
    cutCrumbs: 6,
    cutFlightMs: 650,
    cutStaggerMs: 40,
    cutArc: 90,
    cutGapeMs: 400,
    cutEase: 'Quad.easeInOut',
    cutEndAlpha: 0.3,
  },
  ghost: {
    fadeAlpha: 0.45,
    /** Fades to `fadeAlpha`, holds, and comes back (each way takes `fadeMs`). */
    fadeMs: 200,
    holdMs: 360,
    joyMs: 650,
    /** The dashed lines the ghost "draws" from the top corners of the layer. */
    drawLength: 256,
    drawMs: 650,
    drawAlpha: 0.9,
    color: GHOST_VIOLET,
  },
  twins: {
    /** The top shell lifts this far, holds, and settles back (each way takes `liftMs`). */
    liftPx: 46,
    liftMs: 190,
    holdMs: 150,
    liftEase: 'Sine.easeInOut',
    /** The cream that flashes in the widened gap. */
    creamColor: parseHex(CREATURES.twins.palette.accent),
    creamAlpha: 0.95,
    /** Both faces strain: the twins argue. */
    argueMs: 700,
  },
  lemon: {
    scrunchMs: 700,
    squashX: 0.9,
    squashY: 1.1,
    squashMs: 260,
    drops: {
      count: 10,
      style: { ...SPARKLE, gravity: 800, speed: [160, 340], spreadDeg: 240, scaleTo: 0.5 },
    },
    dropColors: [LEMON, LEMON_PALE],
  },
  rainbow: {
    joyMs: 700,
    /** Stripes of the wave that crosses the screen, in the order of the rainbow. */
    stripes: [
      0xff5c5c,
      0xff9f43,
      0xffe14d,
      PALETTE.success,
      RARITY_COLORS.rare,
      0x6c5ce7,
      0xc56cf0,
    ],
    stripeWidth: 70,
    stripeGapPx: 56,
    waveMs: 900,
    waveEase: 'Sine.easeInOut',
    /** The stripes are this share of the screen height tall and leaning by `tiltDeg`. */
    heightShare: 1.3,
    tiltDeg: 12,
    waveAlpha: 0.5,
    sparks: { count: 12, style: SPARKLE },
  },

  /** What stays on while an effect is active. */
  active: {
    /** Share of the distance closed per 60 Hz frame when a visual fades in or out. */
    fadeLerp: 0.15,
    ghost: {
      guideAlpha: 1,
      guideWidth: GUIDE_WIDTH,
      /** Dashes run up the guides at this speed (px/s). */
      guideSpeed: 90,
      color: GHOST_VIOLET,
      glowColor: ICE,
      glowAlpha: [0.45, 0.8],
      glowPeriodMs: 500,
      glowGrow: 18,
    },
    shield: {
      /** Extra width on both sides of the top layer, and height in layers. */
      padX: 80,
      heightLayers: 2.5,
      /** Centre of the bubble below the top surface, in layers. */
      centerLayers: 0.45,
      alpha: 1,
      popInMs: 260,
      popInEase: 'Back.easeOut',
      pulse: 0.025,
      pulsePeriodMs: 1100,
      /** Pop: swells and fades. */
      popMs: 220,
      popScale: 1.35,
      /** Melt: sags and fades. */
      meltMs: 600,
      meltScaleY: 0.55,
      popChips: {
        count: 12,
        style: { ...SPARKLE, gravity: 900, speed: [180, 420], spreadDeg: 360 },
      },
      meltDrips: {
        count: 4,
        style: { ...CLOUD_RISE, gravity: 700, speed: [10, 50], spreadDeg: 90 },
      },
      chipColors: [CHOCOLATE, CHOCOLATE_LIGHT, CHOCOLATE_CRUST],
    },
    frosty: {
      tint: ICE,
      coatAlpha: 0.38,
      /** Where the ice crystals sit on the layer: share of half the width and of half the height. */
      crystalSlots: [
        [-0.85, -0.7],
        [-0.55, 0.75],
        [-0.2, -0.8],
        [0.1, 0.7],
        [0.35, -0.65],
        [0.6, 0.8],
        [0.85, -0.2],
        [-0.9, 0.1],
        [0.0, 0.0],
      ],
      crystalScale: [0.9, 1.5],
      crystalColor: 0x6cb6ff,
      /** Crystal `i` is turned by `i * angleStep` degrees, wrapped at `angleWrap`. */
      crystalAngleStep: 47,
      crystalAngleWrap: 180,
      crystalAlpha: [0.55, 1],
      twinklePeriodMs: 900,
    },
    lemon: {
      color: LEMON,
      alpha: [0.5, 0.75],
      periodMs: 1400,
      /** Steady alpha with "fewer effects". */
      reducedAlpha: 0.45,
    },
    rainbow: {
      coatAlpha: 0.55,
      saturation: 0.7,
      /** Hue turns once this long. */
      huePeriodMs: 1800,
      /** Hue distance between the left and the right edge of the layer. */
      hueSpread: 0.45,
      glossEveryMs: 900,
    },
  },
} as const;

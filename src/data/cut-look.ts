/**
 * The cut of an overhang (docs/06-art-animation-audio.md, "Срезы с характером"): which variant a
 * cut gets, how the piece moves, the glaze strands and the panicking piece. Distances are world
 * pixels, durations milliseconds, angles degrees.
 */
export const CUT_LOOK = {
  /** Name of the cosmetic stream forked per cut (`fork('cut')`, then the layer number). */
  stream: 'cut',
  /** A piece narrower than this share of the layer before the cut is no piece: only crumbs. */
  thinShare: 0.08,
  /** A piece wider than this share is a big one: strands and panic. */
  bigShare: 0.35,
  /** A big piece comes at most once per this many layers; a nearer one gets the normal choice. */
  bigEveryLayers: 10,
  /** Chance of strands on a cut ("every 4th miss"). */
  strandChance: 0.25,
  /** Chance of a panicking piece ("every 7th miss"), drawn independently. */
  panicChance: 1 / 7,
  /** A piece narrower than this (px) has no room for a face and never panics. */
  panicMinWidth: 130,

  /** The piece stays for a moment and sags before it lets go. */
  anticipationMs: 60,
  sagPx: 3,
  tiltDeg: 3,
  /** Squash while it sags: the piece gets wider and lower by this much. */
  sagSquash: 0.03,
  /** The squash of the sag lets go over this long after the let-go. */
  sagRecoverMs: 90,
  /** Fall after the let-go. */
  fallMs: 900,
  gravity: 2400,
  /** The piece fades in the last share of its life only. */
  fadeFrom: 0.75,
  /** Spin of the piece (deg per second) by its width: fast when narrow, slow when big. */
  spin: { narrowPx: 60, widePx: 400, narrowDegPerSec: 360, wideDegPerSec: 120 },
  /**
   * How the let-go builds up: the spin and the pull of gravity start low and grow over this long
   * after the let-go, so strands do not swing wildly and a scared piece stays in view. Per kind of cut.
   */
  ramp: {
    plain: { spinDelayMs: 0, spinMs: 120, gravityStart: 1, gravityMs: 1, driftSpeed: 70 },
    strands: { spinDelayMs: 260, spinMs: 360, gravityStart: 0.5, gravityMs: 420, driftSpeed: 170 },
    panic: { spinDelayMs: 0, spinMs: 320, gravityStart: 0.3, gravityMs: 700, driftSpeed: 60 },
  },
  /** Crumbs from the cut line. */
  crumbs: { full: [5, 8], lite: 3 },

  strands: {
    /** From the let-go: thick bridge, then stretch, snap at `snapMs`, recoil. */
    bridgeMs: 110,
    snapMs: 330,
    recoilMs: 150,
    /** Strands per cut and their traits: where they hold on the glaze band (share), thickness and when they snap (ms from `snapMs`). */
    count: [2, 3],
    traits: [
      { band: 0.5, thick: 1, snapShift: 0, sag: 1 },
      { band: 0.15, thick: 0.72, snapShift: -25, sag: 0.8 },
      { band: 0.85, thick: 0.52, snapShift: 25, sag: 1.2 },
    ],
    /** Glaze band at the cut edge (px from the layer centre) and how far inside the layers the strands hold on. */
    bandTop: -47,
    bandBottom: -27,
    inset: 4,
    /** Thickness of a strand's middle (px, at the thickest trait): the bridge, and just before it snaps. */
    midThickStart: 26,
    midThickEnd: 8,
    /** Thickness of a strand at its anchors (px). */
    endThick: 34,
    /** Droop of the middle point: share of the strand length, at most `droopMaxPx`. */
    droopShare: 0.12,
    droopMaxPx: 18,
    /** The middle bows outwards (the piece drifts out): share of the length, at most `bowMaxPx`. */
    bowShare: 0.08,
    bowMaxPx: 22,
    /** Sideways wobble of the middle point (px) and its period. */
    wobblePx: 1.5,
    wobbleMs: 160,
    /** Beads sliding down a strand. */
    beads: { count: [1, 2], sizePx: 12, speed: 0.0016, startShare: 0.12 },
    /** The bridge of glaze at the let-go: a blob on the cut that grows in `growMs`, then shrinks and fades over `settleMs` as the strands take over. Size in px at its thickest. */
    blob: { widthPx: 38, heightPx: 54, growMs: 50, settleMs: 300 },
    /** After the snap: the stubs spring back with overshoot and curl, drops fall. */
    recoil: { restShare: 0.14, curlDeg: 55, bulge: 1.7, fadeFrom: 0.55 },
    drops: { count: [2, 3], sizePx: 20, gravity: 2000, speedX: 90, lifeMs: 420 },
    /** The drop that stays on the cut edge of the layer. */
    trace: {
      widthPx: 32,
      heightPx: 48,
      growMs: 260,
      /** Where it hangs, from the layer centre. */
      insetPx: 12,
      y: -36,
      swing: { amplitudeDeg: 14, periodMs: 620, decayMs: 750 },
    },
  },

  panic: {
    /** Arms: size, where they sit on the piece (share of its width from the centre, px from its centre in height), the wave. */
    arm: { length: 48, thick: 15, handPx: 24 },
    /** Where the shoulders sit: this far in from the side of the piece, and this far from its centre in height. */
    armInset: 2,
    armY: -4,
    /** The arms grow out over this long after the let-go. */
    armGrowMs: 100,
    waveDeg: 50,
    wavePeriodMs: 130,
    /** The arm's rest pose from straight up, outwards. */
    restDeg: 25,
    /** Motion dashes beside the piece. */
    dashes: { count: [2, 3], flickerMs: 90, gap: 34, lift: 18, stagger: 10, fadeInMs: 80 },
  },
} as const;

/** Variants a cut can be forced to (the dev hook and the benchmark). */
export const CUT_VARIANT_NAMES = ['plain', 'strands', 'panic', 'big'] as const;
export type CutVariantName = (typeof CUT_VARIANT_NAMES)[number];

/** The baked pictures of the cuts (keys of the shared atlas, `fx_` prefix). White fill and a grey outline: shown tinted, the outline becomes a darker tone of the fill colour. */
export const CUT_TEXTURES = {
  /** Half a strand, thick at its open left end, thin at its right end: one picture per stage of thinning. */
  strand: ['fx_cut_strand_0', 'fx_cut_strand_1', 'fx_cut_strand_2', 'fx_cut_strand_3'],
  bead: 'fx_cut_bead',
  blob: 'fx_cut_blob',
  hang: 'fx_cut_hang',
  arm: 'fx_cut_arm',
  dash: 'fx_cut_dash',
} as const;

/** Shapes of the baked pictures. */
export const CUT_PICTURE = {
  /** Grey of the outline: tinted by a colour it gives that colour's darker tone. */
  outlineGrey: 0x9a9a9a,
  /** Empty room around the drawing (the picture field rule). */
  pad: 4,
  outline: 4,
  strand: {
    length: 96,
    /** Thickness at the open end. */
    thick: 24,
    /** Thickness at the thin end, per stage of thinning, as a share of `thick`. */
    midShare: [1, 0.72, 0.46, 0.26],
    /** The flare at the open end holds the full thickness this far (share of the length). */
    flareHold: 0.18,
  },
  bead: { size: 16 },
  blob: { width: 38, height: 54 },
  hang: { width: 32, height: 48 },
  dash: { length: 34, thick: 7 },
} as const;

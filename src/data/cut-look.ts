/**
 * The cut of an overhang (docs/06-art-animation-audio.md, "Срезы с характером"): which variant a
 * cut gets, how the piece moves, the glaze strands and the panicking piece. Distances are world
 * pixels, durations milliseconds, angles degrees.
 */
export const CUT_LOOK = {
  /** Name of the cosmetic stream forked per cut (`fork('cut')`, then the layer number). */
  stream: 'cut',
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
    strands: { spinDelayMs: 260, spinMs: 360, gravityStart: 0.5, gravityMs: 420, driftSpeed: 240 },
    panic: { spinDelayMs: 0, spinMs: 320, gravityStart: 0.3, gravityMs: 700, driftSpeed: 60 },
  },
  /** Crumbs from the cut line. */
  crumbs: { full: [5, 8], lite: 3 },

  /**
   * The glaze strands (docs/06, "Срезы с характером"). Thicknesses are world px of the 1080 px wide
   * game: on a 390 CSS px screen one screen px is 2.77 of them (ends 4-6 px, middle 1.5-2 px, beads
   * 5-7 px on the screen). A thickness is the whole strand, its outline included.
   */
  strands: {
    /** The middle starts `bridge` times as thick as the ends (the strands lie together: one short bridge) and thins to its own `mid` over `thinMs`. */
    bridge: 1.15,
    thinMs: 170,
    /** When the strands snap (ms from the let-go, plus the trait's `snapShift`) and how long the ends spring back. */
    snapMs: 330,
    recoilMs: 160,
    count: [2, 3],
    /**
     * Strands per cut and their traits: where they hold on the glaze band of the layer and of the
     * piece (share from its top), thickness at the ends and in the middle (px), how much they sag,
     * where along them the thinnest point (and the break) is, when they snap (ms from `snapMs`).
     * The lowest strand snaps first and the highest last: a drop that starts lower and earlier
     * always falls ahead of the next one and never gets caught up.
     */
    traits: [
      {
        layerBand: 0.5,
        pieceBand: 0.45,
        end: 16,
        mid: 5.5,
        sag: 1,
        breakU: 0.5,
        snapShift: 0,
      },
      {
        layerBand: 0.2,
        pieceBand: 0.15,
        end: 13,
        mid: 4.6,
        sag: 0.55,
        breakU: 0.57,
        snapShift: 90,
      },
      {
        layerBand: 0.92,
        pieceBand: 1,
        end: 11.5,
        mid: 4.2,
        sag: 1.5,
        breakU: 0.44,
        snapShift: -90,
      },
    ],
    /** Glaze band at the cut edge (px from the layer centre). */
    bandTop: -50,
    bandBottom: -27,
    /** The strands hold on this far inside the cut edge (on its outline), at most `insetMaxShare` of the piece width. */
    inset: 3,
    insetMaxShare: 0.3,
    /** The thickness flares to the ends along this power of the distance from the thinnest point (more: a longer thin middle). */
    profilePower: 2.4,
    /** Outline of a strand per side: this share of its thickness, within [minPx, maxPx]. */
    outline: { share: 0.2, minPx: 1, maxPx: 3 },
    /**
     * The outline is the dark tone of the glaze edge warmed by this much of a warm brown: on a
     * yellow glaze plain darkening gives an olive line, this gives amber.
     */
    warm: { color: 0x7a3410, share: 0.25 },
    /** The middle sags this share of the length (at most `maxPx`), growing in with the stretch. */
    sag: { share: 0.24, maxPx: 30 },
    /** Sideways wobble of the middle (px) and its period. */
    wobblePx: 1.5,
    wobbleMs: 170,
    /** Phase of the wobble per strand: radians per unit of the trait's `breakU`. */
    wobblePhase: 9,
    /** Rows of the ribbon of each half and of the round cap of a snapped end. */
    rows: 18,
    capRows: 5,
    /** Beads sliding down the strands: one per half, the piece half's only on some strands. */
    beads: {
      /** Diameter, outline included (px), per bead: the first is the bigger one. */
      sizePx: [18, 15],
      /** Each next strand's beads are this much smaller (px). */
      stepPx: 0.5,
      /** Share of the strands that get a second bead (on the piece half). */
      secondShare: 0.5,
      /** They form after the bridge, grow in over `growMs`, and slide from `from` to `to` (share of the half from its anchor), quicker and quicker. */
      startMs: 110,
      growMs: 90,
      from: 0.3,
      fromSpread: 0.1,
      /**
       * Where each bead stops (share of its half from its anchor). The layer half's comes down
       * nearly to the break, the lowest point of the strand, and drops from there: the drops of
       * the strands start one below the other. The piece half's stays higher up, so it never sits
       * by the one that drops.
       */
      to: [0.92, 0.5],
      slideMs: 130,
      /** The strand under a bead is this much thicker (share of the bead size), over this long a stretch (px, gaussian). */
      bump: 0.15,
      bumpPx: 5,
    },
    /** Light stripe along a strand: its width and lift as shares of the fill's half width; none where the fill is thinner than `minFillPx`. */
    gloss: { width: 0.3, lift: 0.42, minFillPx: 5, lightLift: 0.45 },
    /** A light dot on a bead and a drop: size share and where it sits (share of the size, left and up). */
    dot: { size: 0.28, dx: 0.2, dy: 0.22, flat: 0.75 },
    /** After the snap: each end springs back with an overshoot, then goes into the glaze. */
    recoil: {
      /**
       * The free end flies back along the path of the half to this share of it by `springU` of the
       * recoil (with `backOut`), round and thicker as it comes back (the half keeps its profile).
       */
      restShare: 0.18,
      /** ...but never longer than this (px): a short round stub on the cut face, not a stick. */
      restPx: 8,
      springU: 0.55,
      /** The piece keeps a small glaze dot of this size (px) on its cut corner, fading with the piece. */
      nubPx: 9,
    },
    drops: {
      /** One per strand: the bead nearest the break drops off at the snap. */
      gravity: 2000,
      /** Speed it starts with: the side drift of the piece share, and down. */
      driftShare: 0.3,
      /** It snaps off: falling at once, so the next drop of the cut finds it gone, never touching it. */
      downSpeed: 300,
      /**
       * Each later drop of a cut goes this much more outwards (px/s; less, when below 0): a later
       * strand breaks further out, so the drops before it must not drift into its spot.
       */
      laneSpeed: -30,
      /**
       * The teardrop is this much taller than wide, from round (the bead it was) over `tallMs`;
       * it stretches along its speed.
       */
      tall: 1.25,
      tallMs: 120,
      stretchPerSpeed: 0.0005,
      maxStretch: 0.5,
      lifeMs: 460,
      fadeFrom: 0.5,
      endScale: 0.8,
    },
    /** The drop that stays on the cut edge of the layer: the picture of the layer's own drip end. */
    trace: {
      growMs: 260,
      /**
       * Where it hangs: from the glaze edge just inside the sponge strip of the cut, this far
       * (px) from where the glaze ends, with this share of it above the glaze edge.
       */
      gapPx: 2,
      aboveShare: 0.2,
      swing: { amplitudeDeg: 14, periodMs: 620, decayMs: 750 },
    },
  },

  panic: {
    /** Arms: size, where they sit on the piece (share of its width from the centre, px from its centre in height), the wave. */
    arm: { length: 40, thick: 15, handPx: 28, thumbPx: 13, thumbOutPx: 11 },
    /** The lighter side of the arm: its width (px) and how far it is from the arm's middle (px); lighter share of the cake colour. */
    light: { widthPx: 4, offsetPx: 3.5, mix: 0.4 },
    /** Where the shoulders sit: this far in from the side of the piece, and this far from its centre in height. */
    armInset: 2,
    armY: -4,
    /** A face keeps this far (px, half its width and a margin) from the screen edge; it slides along the piece at this ease (share per frame). */
    faceKeepPx: 70,
    faceEase: 0.3,
    /** The face slides only while the piece is turned flat: from this cosine of its turn, fully `flatRange` above it. */
    flatFrom: 0.2,
    flatRange: 0.3,
    /** The arms grow out over this long after the let-go. */
    armGrowMs: 100,
    /** An arm starts this share of its size. */
    armStartScale: 0.3,
    waveDeg: 50,
    wavePeriodMs: 130,
    /** The arm's rest pose from straight up, outwards. */
    restDeg: 25,
    /** Motion dashes beside the piece. */
    dashes: {
      count: [2, 3],
      /** Sideways gap between dashes, the gap behind the piece, and how far every other one lags (px). */
      gap: 30,
      behind: 14,
      stagger: 14,
      /** They show as the piece picks up speed: fully at `fullSpeed` (px/s); the length follows the speed. */
      fullSpeed: 420,
      lengthScale: [0.55, 1.2],
      /** Gentle breathing of the opacity (share and period, ms). */
      breath: { share: 0.2, periodMs: 260 },
      /** Fade of the dashes with the piece (they follow its alpha), and the ease of the speed estimate (0..1 per frame). */
      speedEase: 0.35,
      alpha: 0.9,
    },
  },
} as const;

/** Variants a cut can be forced to (the dev hook and the benchmark). */
export const CUT_VARIANT_NAMES = ['plain', 'strands', 'panic', 'big'] as const;
export type CutVariantName = (typeof CUT_VARIANT_NAMES)[number];

/**
 * The baked pictures of the cuts (keys of the shared atlas, `fx_` prefix). The glaze of the strands
 * is white pictures laid on bending strips (`Rope`) and tinted: the glaze colour for the fills, the
 * dark tone of the glaze edge for the outlines, a light tone for the gloss.
 */
export const CUT_TEXTURES = {
  /** Across a strip: white with soft long sides; a strand, its outline and its gloss stripe are strips of it. */
  ribbon: 'fx_cut_ribbon',
  /** A white disc: beads, their outlines and the light dots. */
  bead: 'fx_cut_bead',
  /** A white teardrop, its point up: a falling drop and its outline. */
  drop: 'fx_cut_drop',
  arm: 'fx_cut_arm',
  armOutline: 'fx_cut_arm_o',
  /** The lighter side of an arm and the light spot of its hand. */
  armLight: 'fx_cut_arm_l',
  dash: 'fx_cut_dash',
} as const;

/** Shapes of the baked pictures. */
export const CUT_PICTURE = {
  /** Empty room around the drawing (the picture field rule). */
  pad: 4,
  outline: 4,
  /** The strip picture: width across, height along, and the soft edge on each long side (px). */
  ribbon: { width: 24, height: 8, soft: 2 },
  bead: { size: 32 },
  /** The teardrop: width and height of the shape, the radius of its point. */
  drop: { width: 28, height: 36, tipRadius: 2.5, neckCurve: 1.1 },
  dash: { length: 34, thick: 7 },
} as const;

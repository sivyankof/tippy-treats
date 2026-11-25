/**
 * Look and timing of the first-run hints (docs/02-gameplay.md, section 11). Durations are
 * milliseconds, positions are shares of the screen height or logical pixels, angles degrees.
 * Every object keeps moving (pulse, bob, sway): nothing on the run screen stands still.
 */
export const TUTORIAL_ANIM = {
  /** The hand and "Tap!" over the play area while the first layers fly. */
  tap: {
    /** Gap between the lowest point of the hand and the top of the flying row. */
    gapAboveFlight: 40,
    fontSize: 110,
    textGap: 40,
    /** The hand taps down and back up with this period. */
    periodMs: 800,
    tapDistance: 36,
    /** At the press the hand is wider and shorter by these shares (the fingertip stays on the touch point). */
    squashX: 0.1,
    squashY: 0.14,
    /** The text breathes. */
    textScale: 0.06,
    textPeriodMs: 1100,
    fadeInMs: 250,
    fadeOutMs: 200,
  },
  /**
   * The chubby glove that taps (`game/tutorial/hand-shape.ts`): a short thick finger, two round
   * knuckles, a thumb, a palm and a soft cuff, drawn after a sketch in units of its own and
   * scaled by `scale`. The picture is tilted as a whole.
   */
  hand: {
    scale: 0.78,
    tiltDeg: -10,
    /** The tone the outline is darkened from: a warm tan, since a darkened cream would turn grey. */
    outlineBase: 0xd88a5e,
    /** The cuff and its shadow tone. */
    cuffColor: 0xff8fb0,
    cuffShadow: 0xe0668f,
    /** Sketch units cut off the lit palm on the right and at the bottom: the shadow band. */
    palmShadowRight: 14,
    palmShadowBottom: 34,
    /** Sketch units cut off the lit cuff on the right and at the bottom. */
    cuffShadowRight: 8,
    cuffShadowBottom: 14,
    glossAlpha: 0.95,
    cuffGlossAlpha: 0.6,
    /** The cuff's own outline over the palm is this thick, logical pixels. */
    cuffRim: 4,
    /** Knuckle creases: stroke width in sketch units and opacity. */
    creaseWidth: 6,
    creaseAlpha: 0.8,
  },
  /** Gold rays that fly out of the fingertip at each press (not on minimal effects). */
  rays: {
    count: 6,
    /** The rays are spread over this angle around straight up, degrees. */
    spreadDeg: 150,
    /** Length and thickness of one ray picture, logical pixels. */
    length: 26,
    thick: 11,
    /** Outline of a ray, logical pixels. */
    outline: 2.5,
    /** Distance of the inner end from the touch point at the start, and how far a ray travels. */
    startRadius: 22,
    travel: 24,
    /** How long a ray lives after the press, ms, and the share of it after which it fades. */
    lifeMs: 420,
    fadeFrom: 0.4,
    /** The ray ends up this much shorter. */
    shrink: 0.45,
  },
  /** The first perfect drop of a session. */
  firstPerfect: {
    /** Gap between the bottom of the text and the top of the flying row. */
    gapAboveFlight: 40,
    fontSize: 150,
    popMs: 280,
    popFromScale: 0.4,
    popOvershoot: 1.15,
    holdMs: 700,
    fadeMs: 420,
    /** Slow wobble of the text while it hangs, degrees. */
    swayDeg: 3,
    swayMs: 700,
    /** Full-screen flash, skipped in "fewer effects" mode. */
    flashAlpha: 0.55,
    flashMs: 450,
  },
  /** A caption on a plate: the Honey intro, the wobble hint and the berry hint. */
  caption: {
    width: 780,
    padX: 36,
    padY: 24,
    fontSize: 46,
    lineSpacing: 6,
    fadeInMs: 220,
    fadeOutMs: 260,
    /** Sway of the plate while it hangs. */
    swayDeg: 0.8,
    swayMs: 1500,
    breathe: 0.012,
    maxAlpha: 0.97,
    /** Sway phase offset of the second caption, radians. */
    secondPhase: 2.2,
    /** Sway phase offset of the third caption, radians. */
    thirdPhase: 4.1,
    /** Sway phase offset of the fourth caption, radians. */
    fourthPhase: 5.3,
    /** Phase offset of the breathing against the sway, radians. */
    breathePhase: 1.4,
    /** Least gap between the HUD and a plate. */
    hudGap: 30,
  },
  /** The arrow that points at the creature layer. */
  arrow: {
    width: 120,
    height: 150,
    /**
     * Gap between the arrow tip and the top edge of the layer: the arrow stands above the
     * landing texts ("Perfect!", "Boosted!") that rise from the Honey layer.
     */
    gap: 230,
    bobPx: 18,
    periodMs: 600,
    /** Gap between the arrow and the caption plate above it. */
    captionGap: 16,
    /** Stem of the arrow: left edge and width as shares of the arrow width. */
    stemX: 0.3,
    stemWidth: 0.4,
    /** Where the head starts, as a share of the arrow height. */
    headY: 0.45,
    /** How far the stem runs under the head, and its corner radius. */
    stemOverlap: 10,
    stemRadius: 14,
  },
  /**
   * Where a hint plate of a run may stand (`game/tutorial/hint-spot.ts`): clear of the top layer
   * of the tower, the flying row and the shadow, by `gap`.
   */
  hintSpot: {
    gap: 40,
    /** Least gap between the plate and the bottom of the screen. */
    screenMargin: 40,
    /** The shadow hint on the top layer is this tall (its width is the layer's). */
    shadowHeight: 50,
  },
  /** The berry hint stands where the wobble hint does. */
  berryHint: {
    holdMs: 3500,
  },
  /**
   * The cloud hint: an arrow under the shadow of the hidden layer (it follows the shadow) and a
   * plate in a free zone (`hintSpot`).
   */
  cloudHint: {
    /** Gap between the shadow and the tip of the arrow. */
    arrowGap: 12,
    /** The arrow is the shared one, smaller. */
    arrowScale: 0.55,
    holdMs: 3800,
  },
  /** The wobble hint stands centred in a free zone (`hintSpot`), never over the top layer. */
  wobbleHint: {
    holdMs: 3400,
  },
} as const;

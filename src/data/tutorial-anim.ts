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
    tapScale: 0.12,
    /** The text breathes. */
    textScale: 0.06,
    textPeriodMs: 1100,
    fadeInMs: 250,
    fadeOutMs: 200,
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
  /** A caption on a plate: the Honey intro and the wobble hint. */
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
    /** Outline around the arrow picture, logical pixels. */
    outline: 7,
    /** Stem of the arrow: left edge and width as shares of the arrow width. */
    stemX: 0.3,
    stemWidth: 0.4,
    /** Where the head starts, as a share of the arrow height. */
    headY: 0.45,
    /** How far the stem runs under the head, and its corner radius. */
    stemOverlap: 10,
    stemRadius: 14,
  },
  /** The wobble hint sits on the tower, just under its top surface, centred: never in the flying row. */
  wobbleHint: {
    /** Gap between the top surface of the tower and the top of the plate. */
    gapBelowTop: 40,
    /** Least gap between the plate and the bottom of the screen. */
    screenMargin: 40,
    holdMs: 3400,
  },
} as const;

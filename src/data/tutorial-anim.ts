/**
 * Look and timing of the first-run hints (docs/02-gameplay.md, section 11). Durations are
 * milliseconds, positions are shares of the screen height or logical pixels, angles degrees.
 * Every object keeps moving (pulse, bob, sway): nothing on the run screen stands still.
 */
export const TUTORIAL_ANIM = {
  /** The hand and "Tap!" over the play area while the first layers fly. */
  tap: {
    /** Centre of the group, as a share of the screen height. */
    y: 0.42,
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
    y: 0.42,
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
  },
  /** The arrow that points at the creature layer. */
  arrow: {
    width: 120,
    height: 150,
    /** Gap between the arrow tip and the top edge of the layer. */
    gap: 12,
    bobPx: 18,
    periodMs: 600,
    /** Gap between the arrow and the caption plate above it. */
    captionGap: 16,
  },
  /** The wobble hint sits under the HUD row, centred. */
  wobbleHint: {
    /** Gap between the lowest HUD edge and the top of the plate. */
    gapBelowHud: 30,
    holdMs: 3400,
  },
} as const;

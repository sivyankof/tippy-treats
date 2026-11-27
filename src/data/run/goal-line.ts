import { PALETTE } from '../common/palette';
import { ANIM } from '../common/anim';
import { TREASURE } from '../economy/treasure-anim';

/**
 * The line of the player's own result inside a run (docs/04, section 6; docs/06, sections 4 and 9).
 * Durations in milliseconds, distances in logical pixels. The dashes, the sway and the fade of the
 * record line are in `CONTINUE_ANIM.flag`.
 */
export const GOAL_LINE = {
  /** The line stays away from the first runs: fewer finished runs than this and there is none. */
  minRunsBefore: 2,
  /** Free field around the dashed line in its picture, px (the clip guard asks for 3). */
  linePad: 4,
  /** Colour of the dashes and of the pennant by kind of goal. */
  colors: {
    record: { line: PALETTE.gold, plate: PALETTE.accent },
    yesterday: { line: PALETTE.panel, plate: PALETTE.accentSecondary },
    lastTime: { line: PALETTE.panel, plate: PALETTE.accentSecondary },
    dailyBest: { line: PALETTE.panel, plate: PALETTE.accentSecondary },
  },
  /**
   * The pennant is baked in light neutral tones and tinted per kind: the face is this grey (so the
   * gloss, pure white, stays lighter than the face after the tint) and the outline a dark grey.
   */
  plate: {
    face: 0xe6e6e6,
    height: 78,
    radius: 26,
    /** Room left and right of the widest label inside the plate. */
    padX: 30,
    font: 44,
    /** Width the art sheet bakes the pennant at (a run bakes it as wide as its widest label). */
    sheetWidth: 330,
    /** Pennant colour of the flash: the tint moves towards this at the peak. */
    flashTint: 0xffffff,
  },
  appear: {
    /** The line and the pennant fade in over this time. */
    fadeMs: 320,
    /** Full: the pennant grows from `popFrom` over `popMs` and overshoots by the spring (the "back" easing). */
    popMs: 480,
    popFrom: 0.2,
    spring: 1.9,
  },
  /** A goal is passed (the line and the pennant at the old height). */
  pass: {
    /** Flash: the pennant swells to this scale and turns light, then settles. */
    flashMs: 260,
    flashScale: 1.35,
    /** The pennant hops this high over `hopMs` (full and lite). */
    hopMs: 420,
    hopHeight: 44,
    /** After this time the line and the pennant fade out over `fadeMs`; then the next goal appears. */
    fadeStartMs: 260,
    fadeMs: 380,
  },
  /** The short joy of a pass on the full level: golden sparkles above the pennant. */
  joy: {
    sparkles: 7,
    /** Lift of the sparkle origin above the pennant centre. */
    lift: 30,
    tints: TREASURE.colors.sparkle,
    style: { ...ANIM.perfect.sparkStyle, spreadDeg: 120 },
  },
} as const;

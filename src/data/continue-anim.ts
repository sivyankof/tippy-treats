import { PALETTE } from './palette';

/** Slow motion, the "Continue?" window and the record flag (docs 06 section 4, 07 section 5). */
export const CONTINUE_ANIM = {
  /** Visual time runs at this share of real time while the missed layer falls past. */
  slowMoScale: 0.3,
  /** "No thanks" appears this long after the window opens (accidental-tap guard). */
  declineDelayMs: 1000,
  /** The last seconds of the timer get a tick and turn orange. */
  urgentFromMs: 2000,
  /** Easing names shared by the window and the flag. */
  ease: { sine: 'Sine.easeInOut', pop: 'Back.easeOut' },
  window: {
    depth: 400,
    /** Title and height text breathe between 1 and this scale. */
    titlePulse: { scale: 1.05, ms: 1100 },
    width: 900,
    height: 1060,
    radius: 56,
    shadowOffset: 14,
    /** Gap between the window and the bottom edge of the screen. */
    bottomMargin: 36,
    slideInMs: 380,
    slideInEase: 'Back.easeOut',
    slideOutMs: 220,
    slideOutEase: 'Quad.easeIn',
    /** The whole window floats up and down a little while it waits. */
    bobDistance: 8,
    bobPeriodMs: 1900,
    /** Content rows: y from the top of the window. */
    titleY: 100,
    titleFont: 84,
    heightY: 205,
    heightFont: 56,
    timerY: 430,
    adButtonY: 740,
    berryButtonY: 890,
    declineY: 1000,
  },
  timer: {
    radius: 128,
    ringWidth: 26,
    /** Opacity of the grey ring behind the arc. */
    trackAlpha: 0.65,
    /** The arc is redrawn at most this often. */
    redrawStepMs: 40,
    digitFont: 150,
    /** The digit pops when the second changes. */
    popScale: 1.25,
    popMs: 260,
    color: PALETTE.success,
    urgentColor: PALETTE.danger,
  },
  button: {
    width: 760,
    height: 128,
    radius: 44,
    shadowOffset: 10,
    font: 60,
    /** Look of a button that cannot be pressed. */
    disabledAlpha: 0.5,
    berryIconSize: 72,
    berryGap: 16,
  },
  decline: {
    font: 44,
    /** The small link-like button pulses between these alphas. */
    alphaRange: [0.55, 1],
    pulseMs: 1400,
    fadeInMs: 240,
    /** Hit area of the small button. */
    hitWidth: 420,
    hitHeight: 96,
  },
  flag: {
    /** The record line: dashes across the tray, and a label on a small pennant. */
    lineHeight: 10,
    dashLength: 36,
    dashGap: 22,
    lineColor: PALETTE.gold,
    lineAlpha: [0.55, 0.9],
    pulseMs: 1300,
    labelFont: 44,
    labelWidth: 230,
    labelHeight: 78,
    labelRadius: 24,
    /** Distance of the pennant from the right edge of the screen. */
    labelInset: 30,
    waveDeg: 4,
    /** The pennant stretches by this share of the wave. */
    waveStretch: 0.04,
    pennantDarken: -0.3,
    /** Border width of the pennant. */
    outline: 6,
    wavePeriodMs: 1700,
    bobDistance: 6,
    bobPeriodMs: 2100,
    /** After the record is beaten the flag fades out. */
    fadeMs: 800,
    /** The "Record!" text pops this far above the line, over the "Perfect! xN" text of the same landing. */
    popLiftY: 320,
  },
} as const;

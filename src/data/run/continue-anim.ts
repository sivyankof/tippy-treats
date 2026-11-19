import { PALETTE } from '../common/palette';

/** Slow motion, the "Continue?" window and the record flag (docs 06 section 4, 07 section 5). */
export const CONTINUE_ANIM = {
  /** Visual time runs at this share of real time while the missed layer falls past. */
  slowMoScale: 0.3,
  /** Every button of the window is inactive this long after it opens (accidental-tap guard), then all switch on at once. */
  inputDelayMs: 600,
  /** The last seconds of the timer get a tick and turn orange. */
  urgentFromMs: 2000,
  /** Easing names shared by the window and the flag. */
  ease: { sine: 'Sine.easeInOut', pop: 'Back.easeOut' },
  window: {
    depth: 400,
    /** The height text breathes between 1 and this scale (the ribbon title breathes by itself). */
    titlePulse: { scale: 1.05, ms: 1100 },
    /** The window plate of the kit (`VolumePlate` 'window'); the ribbon title sits on its top edge. */
    width: 900,
    height: 1040,
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
    heightY: 150,
    heightFont: 56,
    timerY: 370,
    adButtonY: 700,
    berryButtonY: 850,
    /** Berry balance counter: right edge in line with the buttons, between the timer and the buttons. */
    balanceY: 570,
    declineY: 970,
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
  /** The berry balance in the window: the refusal shake and the berries flying into the pay button. */
  balance: {
    /** At most this many berries fly, however high the price. */
    maxFlying: 8,
    flightMs: 320,
    staggerMs: 35,
    /** Size of a flying berry and the scale it shrinks to on arrival. */
    size: 56,
    endScale: 0.5,
    ease: 'Quad.easeIn',
    /**
     * After a payment the window stays this long with its buttons off, so the number rolls down
     * and the last berry lands (the longest roll is `ANIM.ui.numberRollMs[1]`).
     */
    paidHoldMs: 850,
  },
  decline: {
    font: 44,
    /** Pale caption while the buttons are inactive; it stands there from the first frame. */
    lockedAlpha: 0.35,
    /** The caption turns from pale to normal in this time once the buttons switch on. */
    fadeInMs: 120,
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
    /** Distance of the pennant from the screen edge it stands at. */
    labelInset: 30,
    /**
     * The pennant stands on the side with more free room next to the tower at its height and
     * moves to the other side only when that one has this much more room (no flip-flopping).
     */
    sideHysteresis: 60,
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

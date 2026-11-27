import { HUD_LAYOUT } from './hud-layout';
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
  /**
   * The dash is a small volumetric body: a dark rim, a light face (grey, so the tint of the kind
   * colours it and the gloss stripe stays lighter), a gloss stripe on top and a soft dark shadow
   * under it, all baked into the one line picture. Sizes in px.
   */
  lineLook: {
    rim: { width: 3, color: 0x4a4a4a },
    face: 0xe4e4e4,
    gloss: { inset: 7, height: 3, color: 0xffffff },
    shadow: { offset: 5, spread: 3, steps: 3, alpha: 0.4 },
  },
  /**
   * The pennant stays out from under the HUD: its top never goes above `clearY` (screen y, under the
   * next creature chip, the lowest plate at its side) plus `gap`; a higher goal is labelled there.
   */
  hud: { clearY: HUD_LAYOUT.nextPlate.y + HUD_LAYOUT.nextPlate.height, gap: 16 },
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
    /** The pointer on the top edge of the pennant while it waits under the HUD, towards its line. */
    tail: { width: 46, height: 24 },
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
    flashMs: 300,
    flashScale: 1.4,
    /** The pennant hops this high over `hopMs` (full and lite). */
    hopMs: 520,
    hopHeight: 96,
    /** After this time the line and the pennant fade out over `fadeMs`; then the next goal appears. */
    fadeStartMs: 420,
    fadeMs: 380,
  },
  /** The short joy of a pass on the full level: golden sparkles above the pennant. */
  joy: {
    sparkles: 14,
    /** Lift of the sparkle origin above the pennant centre. */
    lift: 64,
    tints: [0xffffff, TREASURE.colors.goldLight, PALETTE.gold],
    style: {
      ...ANIM.perfect.sparkStyle,
      speed: [420, 760],
      scale: [1.6, 2.6],
      scaleTo: 0.5,
      holdShare: 0.5,
      lifeMs: [550, 800],
      spreadDeg: 150,
    },
  },
} as const;

import { PALETTE } from './palette';

const BAR_Y = 360;
const BAR_HEIGHT = 30;
const BADGE_ROW_Y = 468;
const BADGE_SIZE = 108;

/** The big rounded text button used on the pause and results screens. */
export const MENU_BUTTON = {
  width: 680,
  height: 128,
  radius: 44,
  shadowOffset: 10,
  font: 64,
} as const;

/** The narrower toggle button of the pause window (sound, vibration). */
export const TOGGLE_BUTTON = {
  /** Wide enough for the longest label, "Меньше эффектов: Выкл". */
  width: 680,
  height: 96,
  radius: 36,
  shadowOffset: 8,
  font: 48,
  /** Space between the toggle buttons and the button above them. */
  gap: 40,
  /** Alpha of a toggle that is switched off. */
  offAlpha: 0.55,
} as const;

/** Layout of the run HUD in logical pixels (screen width 1080). */
export const HUD_LAYOUT = {
  heightY: 130,
  scoreY: 270,
  barY: BAR_Y,
  barWidth: 520,
  barHeight: BAR_HEIGHT,
  barPad: 5,
  labelGap: 14,
  /**
   * The plate under the wobble label and gauge: a rounded panel with a soft shadow, `padX` and
   * `padY` around the row. `alpha` is baked into the picture; the shadow is `shadowSteps`
   * rounded rectangles that grow by `shadowBlur` in all, dropped `shadowOffset` down.
   */
  barPlate: {
    padX: 30,
    padY: 10,
    radius: 30,
    color: PALETTE.panel,
    alpha: 0.8,
    shadowColor: PALETTE.textDark,
    shadowAlpha: 0.28,
    shadowOffset: 4,
    shadowBlur: 8,
    shadowSteps: 6,
  },
  /** Colour of the wobble label in the danger state: dark enough to read on the plate (the gauge fill keeps `PALETTE.danger`). */
  barDangerText: 0xa8320a,
  /** Line height of the label font, as a share of its size (what the plate wraps around). */
  labelLineHeight: 1.4,
  heightFont: 150,
  scoreFont: 60,
  /** "Demo: <name>" label of a creature demo, this far above the bottom of the screen. */
  demoLabelBottom: 150,
  demoLabelFont: 52,
  labelFont: 36,
  pauseSize: 96,
  pauseMargin: 24,
  pauseRadius: 28,
  pauseShadow: 6,
  pauseBarWidth: 14,
  pauseBarHeight: 44,
  pauseBarGap: 14,
  /** Centre y of the row under the wobble bar: effect badges on the left, next creature on the right. */
  badgeRowY: BADGE_ROW_Y,
  /** Side of a creature icon in the row. */
  badgeSize: BADGE_SIZE,
  badgeGap: 16,
  badgeMargin: 24,
  /** Counter of an effect badge: font size, and how far it sits in from the icon's bottom right corner. */
  badgeCounterFont: 52,
  badgeCounterInset: 10,
  badgeCounterStroke: 8,
  /** Text of the next-creature indicator. */
  nextFont: 56,
  nextStroke: 8,
  /** The SVG icons are loaded at this multiple of their size so they stay crisp when shown larger. */
  iconTextureScale: 2,
  /** Lowest screen y the HUD (height, score, wobble bar, badge row) reaches. */
  bottomEdge: BADGE_ROW_Y + BADGE_SIZE / 2,
} as const;

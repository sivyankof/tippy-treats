const BAR_Y = 360;
const BAR_HEIGHT = 30;
const BADGE_ROW_Y = 452;
const BADGE_SIZE = 76;

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
  heightFont: 150,
  scoreFont: 60,
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
  badgeGap: 14,
  badgeMargin: 24,
  /** Counter of an effect badge: font size, and how far it sits in from the icon's bottom right corner. */
  badgeCounterFont: 34,
  badgeCounterInset: 8,
  badgeCounterStroke: 6,
  /** Text of the next-creature indicator. */
  nextFont: 40,
  nextStroke: 6,
  /** The SVG icons are loaded at this multiple of their size so they stay crisp when shown larger. */
  iconTextureScale: 2,
  /** Lowest screen y the HUD (height, score, wobble bar, badge row) reaches. */
  bottomEdge: BADGE_ROW_Y + BADGE_SIZE / 2,
} as const;

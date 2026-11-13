const BAR_Y = 360;
const BAR_HEIGHT = 30;

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
  /** Lowest screen y the HUD (height, score, wobble bar) reaches. */
  bottomEdge: BAR_Y + BAR_HEIGHT / 2,
} as const;

const BAR_Y = 360;
const BAR_HEIGHT = 30;
const BADGE_ROW_Y = 468;
const BADGE_SIZE = 108;

/** The pause window: three buttons and the switches under them (a `PopupWindow` of the kit). */
export const PAUSE = {
  button: { width: 680, height: 120, radius: 44, shadowOffset: 10, font: 60 },
  /** Room for the label inside a button. */
  labelPad: 60,
  buttonGap: 26,
  /** Space between the last button and the first switch. */
  togglesTop: 40,
  countdownFont: 320,
  countdownDepth: 800,
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
  /** Room around the wobble label and gauge on their plate (a `HudPlate` of the kit). */
  barPlate: { padX: 30, padY: 8 },
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
  /** The round pause button in the top left corner, the size of the back button of the menus. */
  pauseSize: 96,
  pauseMargin: 24,
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
  /** The see-through wallet chip under that counter: its height and the room beside the digits. */
  badgeChip: { height: 58, padX: 12 },
  /** Text of the next-creature indicator. */
  nextFont: 56,
  nextStroke: 8,
  /** The see-through wallet chip under it: from the icon centre to `padX` past the text. */
  nextChip: { height: 78, padX: 22 },
  /** The SVG icons are loaded at this multiple of their size so they stay crisp when shown larger. */
  iconTextureScale: 2,
  /** Lowest screen y the HUD (height, score, wobble bar, badge row) reaches. */
  bottomEdge: BADGE_ROW_Y + BADGE_SIZE / 2,
} as const;

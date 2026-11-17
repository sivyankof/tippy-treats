const BAR_Y = 346;
const BAR_HEIGHT = 30;
const BADGE_ROW_Y = 468;
const BADGE_SIZE = 108;
const BADGE_COUNTER_INSET = 10;
const BADGE_COUNTER_DROP = 22;
const BADGE_CHIP_HEIGHT = 58;

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
  scoreY: 262,
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
  /** Clear space kept between the wobble plate (its shadow, the badges' bob and pulse included) and the badges. */
  badgeBarGap: 12,
  /**
   * With this many badges in the row (shrinking ones included) the next-creature chip is compact:
   * the creature icon and a number, no words (the icon alone, flashing, on the creature layer).
   */
  compactNextFrom: 3,
  /** Closest the next-creature chip may come to the badges of the row. */
  nextBadgeGap: 16,
  badgeMargin: 24,
  /** Counter of an effect badge: font size, and how far it sits in from the icon's bottom right corner. */
  badgeCounterFont: 52,
  badgeCounterInset: BADGE_COUNTER_INSET,
  /** How far the counter hangs below the icon's bottom edge, so it clears the face. */
  badgeCounterDrop: BADGE_COUNTER_DROP,
  badgeCounterStroke: 8,
  /** The see-through wallet chip under that counter: its height and the room beside the digits. */
  badgeChip: { height: BADGE_CHIP_HEIGHT, padX: 12 },
  /** Side of the gold star on the corner of the badge of a mastery tail (jelly, frosty). */
  badgeTailDot: 36,
  /**
   * The tempo ease chip at the right end of the wobble plate: a see-through plate with the snail and the
   * layers left. `gap` is the space to the wobble plate, `margin` the closest it comes to the screen edge.
   */
  tempoChip: { width: 148, iconSize: 80, iconInset: 10, font: 46, stroke: 7, gap: 10, margin: 16 },
  /** Text of the next-creature indicator. */
  nextFont: 56,
  nextStroke: 8,
  /** The see-through wallet chip under it: from the icon centre to `padX` past the text. */
  nextChip: { height: 78, padX: 22 },
  /** The SVG icons are loaded at this multiple of their size so they stay crisp when shown larger. */
  iconTextureScale: 2,
  /**
   * Where the plates of the run HUD stand (screen px, width 1080): what the weather and other
   * background pictures keep clear of (`hudKeepOutFade`). Measured from the run HUD: the pause button,
   * the height and score digits, the combo count, the wobble plate with the tempo chip, the next
   * creature chip and the badge row.
   */
  plates: [
    { x: 24, y: 24, width: 96, height: 96 },
    { x: 880, y: 26, width: 186, height: 90 },
    { x: 400, y: 60, width: 280, height: 140 },
    { x: 470, y: 226, width: 140, height: 72 },
    { x: 186, y: BAR_Y - 34, width: 708, height: 68 },
    { x: 440, y: 426, width: 620, height: 86 },
    { x: 24, y: BADGE_ROW_Y - BADGE_SIZE / 2, width: 248, height: BADGE_SIZE + 24 },
  ],
  /** Lowest screen y the HUD (height, score, wobble bar, badge row) reaches. */
  bottomEdge: BADGE_ROW_Y + BADGE_SIZE / 2,
  /** Lowest screen y of the badge row including the counter chips that hang under the icons. */
  badgeRowBottom:
    BADGE_ROW_Y + BADGE_SIZE / 2 - BADGE_COUNTER_INSET + BADGE_COUNTER_DROP + BADGE_CHIP_HEIGHT / 2,
} as const;

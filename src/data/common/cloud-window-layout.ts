import { PALETTE } from './palette';

/** Layout of the iCloud windows (docs/07-ui-screens.md, section 2.4): the text, summary cards and buttons. */
export const CLOUD_WINDOW = {
  textFont: 40,
  textGap: 36,
  /** Space between the cards and the text above, and between the two cards of the choice window. */
  cardGap: 24,
  card: {
    /** Padding inside a card. */
    pad: 20,
    headFont: 40,
    lineFont: 36,
    lineHeight: 56,
    /** Space under the head line. */
    headGap: 8,
    dateFont: 30,
    fill: PALETTE.accentSecondary,
  },
  /** Buttons stacked under the single card of the found window. */
  button: { width: 680, height: 112, radius: 40, shadowOffset: 10, font: 48 },
  buttonGap: 26,
  /** The "keep" button under each card of the choice window. */
  keepButton: { height: 104, radius: 36, shadowOffset: 8, font: 44 },
  /** Gap between a card and its button. */
  keepGap: 20,
} as const;

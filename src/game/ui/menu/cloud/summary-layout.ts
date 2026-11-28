import { CLOUD_WINDOW } from '../../../../data/common/cloud-window-layout';

/** Lines of a summary card: level, record, creatures, coins, berries, date. */
export const CARD_LINES = 6;

/** Height of a summary card, with the head line or without it. */
export function summaryCardHeight(withHead: boolean): number {
  const { pad, lineHeight, headGap } = CLOUD_WINDOW.card;
  return pad * 2 + (withHead ? lineHeight + headGap : 0) + CARD_LINES * lineHeight;
}

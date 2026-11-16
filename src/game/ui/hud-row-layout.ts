import { HUD_LAYOUT } from '../../data/hud-layout';
import { badgeCentreX } from './effect-badge-state';

const { badgeSize, badgeMargin, badgeGap, compactNextFrom, nextBadgeGap, nextChip } = HUD_LAYOUT;

/** Right edge of the badge row with `count` badges (shrinking ones included); 0 for an empty row. */
export function badgeRowRight(count: number): number {
  return count > 0 ? badgeCentreX(count - 1) + badgeSize / 2 : 0;
}

/** The next-creature chip drops its words (icon and number only) once the row is this full. */
export function isCompactNext(badgeCount: number): boolean {
  return badgeCount >= compactNextFrom;
}

/** Where the next-creature chip stands: the text hugs the right margin, the icon sits left of it. */
export interface NextChipSpan {
  /** Right end of the text (its origin is the right edge). */
  labelRight: number;
  /** Centre x of the icon. */
  iconX: number;
  chipLeft: number;
  chipRight: number;
}

export function nextChipSpan(screenWidth: number, labelWidth: number): NextChipSpan {
  const labelRight = screenWidth - badgeMargin - nextChip.padX;
  const iconX = labelRight - labelWidth - badgeGap - badgeSize / 2;
  return {
    labelRight,
    iconX,
    chipLeft: iconX - badgeSize / 2 - nextChip.padX,
    chipRight: labelRight + nextChip.padX,
  };
}

/** The chip keeps `nextBadgeGap` between itself and the badge row. */
export function nextChipClearsRow(chipLeft: number, badgeCount: number): boolean {
  return chipLeft >= badgeRowRight(badgeCount) + nextBadgeGap;
}

/**
 * The master caption in the strip of the row: right-aligned at the margin (where the next-creature
 * chip stands, which gives way while it shows). When the plate is wider than the space the badges
 * leave, it shrinks to fit instead of covering them.
 */
export interface CaptionSpot {
  /** Centre x of the plate (before the scale). */
  centreX: number;
  /** Fit scale, at most 1. */
  scale: number;
}

export function captionSpot(
  plateWidth: number,
  badgeCount: number,
  screenWidth: number,
  out: CaptionSpot,
): CaptionSpot {
  const right = screenWidth - badgeMargin;
  const room = right - badgeRowRight(badgeCount) - nextBadgeGap;
  out.scale = Math.min(1, Math.max(0, room) / plateWidth);
  out.centreX = right - (plateWidth * out.scale) / 2;
  return out;
}

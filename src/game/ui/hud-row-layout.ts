import { ANIM } from '../../data/anim';
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

/** Where the next-creature chip stands: the text ends at the right margin, the icon sits left of it. */
export interface NextChipSpan {
  /** Left end of the text (its origin is the left edge, so a pop grows it away from the icon). */
  labelLeft: number;
  /** Right end of the text at rest. */
  labelRight: number;
  /** Centre x of the icon. */
  iconX: number;
  chipLeft: number;
  chipRight: number;
}

/** `labelWidth` is null for the icon alone: the chip then hugs the icon, with no gap for text. */
export function nextChipSpan(screenWidth: number, labelWidth: number | null): NextChipSpan {
  const labelRight = screenWidth - badgeMargin - nextChip.padX;
  const iconX =
    labelWidth === null
      ? labelRight - badgeSize / 2
      : labelRight - labelWidth - badgeGap - badgeSize / 2;
  return {
    labelLeft: labelRight - (labelWidth ?? 0),
    labelRight,
    iconX,
    chipLeft: iconX - badgeSize / 2 - nextChip.padX,
    chipRight: labelRight + nextChip.padX,
  };
}

/**
 * Scale of the text at the peak of its pop: `ANIM.badges.nextPopScale`, less for a wide text, so the growth to the right
 * (the text is pinned at its left edge, next to the icon) stays within the chip padding.
 */
export function nextLabelPopScale(labelWidth: number): number {
  if (labelWidth <= 0) return 1;
  return Math.min(ANIM.badges.nextPopScale, 1 + nextChip.padX / labelWidth);
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

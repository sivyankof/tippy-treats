import { ANIM } from '../../data/common/anim';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import type { EffectLevel } from '../../data/app/effect-levels';
import type { SpotRect } from '../tutorial/hint-spot';

const { inMs, holdMs, outMs, rise } = ANIM.tempoChip.caption;
const { margin, captionGap } = HUD_LAYOUT.tempoChip;

/** What `tempoCaptionSpot` looks at; every size and position is in screen pixels. */
export interface TempoCaptionInput {
  textWidth: number;
  textHeight: number;
  screenWidth: number;
  /** Right edge and top edge of the tempo chip plate. */
  chipRight: number;
  chipTop: number;
  /** Everything the caption must keep clear of: the HUD plates and the flight row. */
  obstacles: readonly SpotRect[];
}

/**
 * Where the caption stands: right-aligned to the chip plate (no closer than `margin` to the screen
 * edge), `captionGap` above it. Returns its rectangle, or `null` when it would touch an obstacle:
 * then there is no room and the caption stays hidden.
 */
export function tempoCaptionSpot(input: TempoCaptionInput): SpotRect | null {
  const right = Math.min(input.chipRight, input.screenWidth - margin);
  const bottom = input.chipTop - captionGap;
  const spot = {
    left: right - input.textWidth,
    top: bottom - input.textHeight,
    right,
    bottom,
  };
  if (spot.left < margin || spot.top < 0) return null;
  const hit = input.obstacles.some(
    (o) => spot.right > o.left && spot.left < o.right && spot.bottom > o.top && spot.top < o.bottom,
  );
  return hit ? null : spot;
}

/** The HUD plates as rectangles. */
export function hudPlateRects(): SpotRect[] {
  return HUD_LAYOUT.plates.map((p) => ({
    left: p.x,
    top: p.y,
    right: p.x + p.width,
    bottom: p.y + p.height,
  }));
}

export interface TempoCaptionLook {
  alpha: number;
  /** Upward offset still to travel, px (0 when settled). */
  lift: number;
}

const SHOWN: TempoCaptionLook = { alpha: 1, lift: 0 };

/**
 * Opacity and lift of the caption `ageMs` after the chip appeared; `null` once it is over. Full
 * effects fade in with a lift, lite only fade, minimal show and hide at once.
 */
export function tempoCaptionLook(ageMs: number, level: EffectLevel): TempoCaptionLook | null {
  if (ageMs < 0 || ageMs >= inMs + holdMs + outMs) return null;
  if (level === 'minimal') return ageMs < inMs + holdMs ? SHOWN : null;
  const fadeIn = Math.min(1, ageMs / inMs);
  const fadeOut = ageMs < inMs + holdMs ? 1 : 1 - (ageMs - inMs - holdMs) / outMs;
  return { alpha: fadeIn * fadeOut, lift: level === 'full' ? rise * (1 - fadeIn) : 0 };
}

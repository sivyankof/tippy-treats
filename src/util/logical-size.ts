export interface LogicalSizeLimits {
  width: number;
  minHeight: number;
  maxHeight: number;
}

/** Safe-area insets of the screen at the top and the bottom (the notch, the island, the gesture bar), CSS px. */
export interface ScreenInsets {
  top: number;
  bottom: number;
}

export interface LogicalSize {
  width: number;
  height: number;
  /** Logical px at the top of the canvas that the interface keeps clear of (under the island or the status bar). */
  safeTop: number;
  /** Logical px at the bottom of the canvas that the interface keeps clear of (the gesture bar). */
  safeBottom: number;
}

const NO_INSETS: ScreenInsets = { top: 0, bottom: 0 };

/**
 * Logical game size for a viewport. The width is fixed. The canvas covers the whole viewport, the
 * system bars included, and the safe band between the insets is what the interface lays out in:
 * its height follows the viewport proportions and is clamped to the supported range. A band
 * shorter than the minimum makes the logical height taller than the viewport proportions (the
 * canvas is fitted with narrow side margins, as on a short screen without insets); a band taller
 * than the maximum leaves margins at the top and the bottom, and the insets are kept in full.
 */
export function computeLogicalSize(
  viewportWidth: number,
  viewportHeight: number,
  limits: LogicalSizeLimits,
  insets: ScreenInsets = NO_INSETS,
): LogicalSize {
  const { width, minHeight, maxHeight } = limits;
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return { width, height: minHeight, safeTop: 0, safeBottom: 0 };
  }
  const top = Math.max(0, insets.top || 0);
  const bottom = Math.max(0, insets.bottom || 0);
  const bandCss = viewportHeight - top - bottom;
  if (!(bandCss > 0)) {
    const raw = Math.round(width * (viewportHeight / viewportWidth));
    return {
      width,
      height: Math.min(maxHeight, Math.max(minHeight, raw)),
      safeTop: 0,
      safeBottom: 0,
    };
  }
  const band = width * (bandCss / viewportWidth);
  // Logical px per CSS px: the width fit, or (a short band) what makes the band exactly the minimum.
  // A tall band keeps the width fit: the canvas is centred with margins and the insets are kept in full.
  const scale = band < minHeight ? minHeight / bandCss : width / viewportWidth;
  const safeTop = Math.round(top * scale);
  const safeBottom = Math.round(bottom * scale);
  if (band < minHeight)
    return { width, height: minHeight + safeTop + safeBottom, safeTop, safeBottom };
  if (band > maxHeight)
    return { width, height: maxHeight + safeTop + safeBottom, safeTop, safeBottom };
  // The band fits: the canvas keeps the viewport proportions exactly, as without insets.
  const height = Math.round(width * (viewportHeight / viewportWidth));
  return { width, height, safeTop, safeBottom };
}

export interface LogicalSizeLimits {
  width: number;
  minHeight: number;
  maxHeight: number;
}

export interface LogicalSize {
  width: number;
  height: number;
}

/**
 * Logical game size for a viewport: the width is fixed, the height follows
 * the viewport proportions and is clamped to the supported range.
 */
export function computeLogicalSize(
  viewportWidth: number,
  viewportHeight: number,
  limits: LogicalSizeLimits,
): LogicalSize {
  const { width, minHeight, maxHeight } = limits;
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return { width, height: minHeight };
  }
  const raw = Math.round(width * (viewportHeight / viewportWidth));
  return { width, height: Math.min(maxHeight, Math.max(minHeight, raw)) };
}

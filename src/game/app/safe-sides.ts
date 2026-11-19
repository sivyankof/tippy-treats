import { readSafeInsets } from './safe-area';

/** Left and right safe-area insets of the screen, logical px. */
export interface SafeSides {
  left: number;
  right: number;
}

const sides: SafeSides = { left: 0, right: 0 };
let measuredFor = '';

/**
 * The side insets of the safe area (`env(safe-area-inset-left/right)`, docs/08, section 6) in
 * logical px of a canvas `logicalWidth` wide; 0 where there are none, as in a desktop browser.
 * Measured again only when the window size changes. The object is reused: read it at once.
 */
export function safeSides(canvas: HTMLCanvasElement, logicalWidth: number): Readonly<SafeSides> {
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (key === measuredFor) return sides;
  measuredFor = key;
  const insets = readSafeInsets();
  const rect = canvas.getBoundingClientRect();
  const toLogical = rect.width > 0 ? logicalWidth / rect.width : 1;
  // Only the part of an inset that reaches over the canvas counts.
  const left = insets.left - rect.left;
  const right = insets.right - (window.innerWidth - rect.right);
  sides.left = Math.max(0, left) * toLogical;
  sides.right = Math.max(0, right) * toLogical;
  return sides;
}

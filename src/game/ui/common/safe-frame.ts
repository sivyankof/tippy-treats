import { safeBand, type SafeBand } from '../../app/safe-area';

/**
 * The part of a canvas that menu interfaces use: the canvas minus the safe band at its top and
 * bottom (the island, the status bar, the gesture bar). Backgrounds fill the canvas; everything
 * the player reads or taps stays between `top` and `bottom`. Without insets it is the whole canvas.
 */
export interface SafeFrame {
  /** Top edge of the frame: the first y the interface may use. */
  top: number;
  /** Bottom edge of the frame: the interface stays above this y. */
  bottom: number;
  /** Height of the frame; layouts made for a screen this tall use it as their height. */
  height: number;
  /** Vertical middle of the frame. */
  centerY: number;
}

/** The frame of a canvas `canvasHeight` tall for `band`; the band never takes more than the canvas has. */
export function frameOf(canvasHeight: number, band: Readonly<SafeBand>): SafeFrame {
  const top = Math.min(Math.max(0, band.top), canvasHeight);
  const bottom = Math.max(top, canvasHeight - Math.max(0, band.bottom));
  return { top, bottom, height: bottom - top, centerY: (top + bottom) / 2 };
}

/** The frame of a canvas `canvasHeight` tall under the current safe band. */
export function safeFrame(canvasHeight: number): SafeFrame {
  return frameOf(canvasHeight, safeBand());
}

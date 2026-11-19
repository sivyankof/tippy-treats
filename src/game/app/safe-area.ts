import type { ScreenInsets } from '../../util/logical-size';
import { readDebugParams } from '../../util/debug-params';

/** Safe-area insets of the screen on all four sides, CSS px. */
export interface SafeInsetsCss extends ScreenInsets {
  left: number;
  right: number;
}

/** Safe band of the interface inside the canvas: logical px kept clear at the top and the bottom. */
export interface SafeBand {
  top: number;
  bottom: number;
}

let probe: HTMLDivElement | null = null;
const band: SafeBand = { top: 0, bottom: 0 };

/**
 * The insets of `env(safe-area-inset-*)` (docs/08, section 6), CSS px; 0 where there are none, as in a
 * desktop browser. The debug parameter `?safe=top,bottom` (dev server and internal build) stands in
 * for the top and bottom ones, so the layout under an island and a gesture bar shows in a browser.
 */
export function readSafeInsets(): SafeInsetsCss {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;height:0;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
      'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const insets: SafeInsetsCss = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
  const forced = readDebugParams().safe;
  if (forced) {
    insets.top = forced.top;
    insets.bottom = forced.bottom;
  }
  return insets;
}

/** Sets the safe band of the current logical size (`game/app/config.ts` calls it with every size). */
export function setSafeBand(top: number, bottom: number): void {
  band.top = top;
  band.bottom = bottom;
}

/**
 * The safe band of the canvas, logical px: the interface keeps `top` px clear at the top and
 * `bottom` px at the bottom; backgrounds still fill the whole canvas. Read it when laying out
 * (scenes lay out again on the scale manager's `resize` event). The object is shared: read at once.
 */
export function safeBand(): Readonly<SafeBand> {
  return band;
}

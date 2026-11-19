import type { SafeBand } from '../app/safe-area';

/** The part of a canvas `canvasHeight` tall that lies between the safe insets: what the run interface lays out in. */
export function bandHeight(canvasHeight: number, band: Readonly<SafeBand>): number {
  return canvasHeight - band.top - band.bottom;
}

/** A screen area given in the interface's own coordinates (the band's top is y 0), moved to canvas coordinates. */
export function toCanvasRegion<T extends { y: number }>(
  region: T | null,
  band: Readonly<SafeBand>,
): T | null {
  return region && { ...region, y: region.y + band.top };
}

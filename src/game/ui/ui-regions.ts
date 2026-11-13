export interface UiRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type RegionSource = () => UiRegion | null;

const sources = new Set<RegionSource>();

/**
 * Registers a screen area that belongs to the interface. Taps inside it must
 * not reach the run. Returns a function that removes the registration.
 */
export function addUiRegion(source: RegionSource): () => void {
  sources.add(source);
  return () => sources.delete(source);
}

export function isOverUi(x: number, y: number): boolean {
  for (const source of sources) {
    const region = source();
    if (
      region &&
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height
    ) {
      return true;
    }
  }
  return false;
}

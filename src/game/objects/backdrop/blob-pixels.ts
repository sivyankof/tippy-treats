import { ditherNoise } from './sky-gradient';

/** A soft round blob of a tile: centre and radius in tile px. */
export interface Blob {
  x: number;
  y: number;
  r: number;
}

/**
 * Fills the rows `from`..`to` (exclusive) of the RGBA pixels `out` of a square white tile of
 * `size` px with soft blobs (opacity `peak` at the centre, falling linearly to 0 at the edge;
 * overlaps combine like layered paint) plus `noise` levels of alpha noise. The tile wraps, so it
 * repeats without seams; a radius must stay under half the tile.
 */
export function fillBlobRows(
  out: Uint8ClampedArray,
  blobs: readonly Blob[],
  size: number,
  peak: number,
  noise: number,
  from: number,
  to: number,
): void {
  const half = size / 2;
  for (let y = from; y < to; y++) {
    for (let x = 0; x < size; x++) {
      let clear = 1;
      for (const blob of blobs) {
        let dx = Math.abs(x - blob.x);
        let dy = Math.abs(y - blob.y);
        if (dx > half) dx = size - dx;
        if (dy > half) dy = size - dy;
        const d = Math.hypot(dx, dy);
        if (d < blob.r) clear *= 1 - peak * (1 - d / blob.r);
      }
      const at = (y * size + x) * 4;
      out[at] = 255;
      out[at + 1] = 255;
      out[at + 2] = 255;
      out[at + 3] = clear < 1 ? (1 - clear) * 255 + ditherNoise(x, y) * noise : 0;
    }
  }
}

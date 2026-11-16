import { describe, expect, it } from 'vitest';
import { fillBlobRows } from './blob-pixels';

const SIZE = 64;
const alphaAt = (px: Uint8ClampedArray, x: number, y: number): number =>
  px[(y * SIZE + x) * 4 + 3] ?? 0;

describe('fillBlobRows', () => {
  const blobs = [{ x: 4, y: 32, r: 20 }];

  it('is brightest in the middle of a blob, falls smoothly and is empty far away', () => {
    const px = new Uint8ClampedArray(SIZE * SIZE * 4);
    fillBlobRows(px, blobs, SIZE, 0.5, 0, 0, SIZE);
    expect(Math.abs(alphaAt(px, 4, 32) - 127.5)).toBeLessThanOrEqual(1);
    expect(alphaAt(px, 14, 32)).toBeLessThan(alphaAt(px, 8, 32));
    expect(alphaAt(px, 40, 32)).toBe(0);
  });

  it('wraps around the tile edge so it repeats without a seam', () => {
    const px = new Uint8ClampedArray(SIZE * SIZE * 4);
    fillBlobRows(px, blobs, SIZE, 0.5, 0, 0, SIZE);
    expect(alphaAt(px, SIZE - 4, 32)).toBeCloseTo(alphaAt(px, 12, 32), 0);
  });

  it('fills only the asked rows', () => {
    const px = new Uint8ClampedArray(SIZE * SIZE * 4);
    fillBlobRows(px, blobs, SIZE, 0.5, 0, 0, 16);
    expect(alphaAt(px, 4, 32)).toBe(0);
    expect(px[3]).toBeGreaterThanOrEqual(0);
  });
});

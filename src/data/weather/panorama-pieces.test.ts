import { describe, expect, it } from 'vitest';
import { PANORAMA, panoramaPieces } from './window-look';

describe('panoramaPieces', () => {
  const pieces = panoramaPieces('kitchen', 'rain');
  const bakedW = Math.round(PANORAMA.width * PANORAMA.bakeScale);
  const bakedH = Math.round(PANORAMA.height * PANORAMA.bakeScale);

  it('cover the whole baked picture edge to edge, once', () => {
    expect(pieces).toHaveLength(PANORAMA.pieces.cols * PANORAMA.pieces.rows);
    const area = pieces.reduce((sum, p) => sum + p.width * p.height, 0);
    expect(area).toBe(bakedW * bakedH);
    for (const p of pieces) {
      expect(p.x + p.width).toBeLessThanOrEqual(bakedW);
      expect(p.y + p.height).toBeLessThanOrEqual(bakedH);
    }
  });

  it('are small enough for the 160 px shelves of the layer pictures', () => {
    for (const p of pieces) expect(p.height + 4).toBeLessThanOrEqual(156);
  });

  it('are centred on their own rectangles, in drawn px, and balance around the picture centre', () => {
    for (const p of pieces) {
      expect(p.centreX).toBeCloseTo((p.x + p.width / 2 - bakedW / 2) / PANORAMA.bakeScale);
      expect(p.centreY).toBeCloseTo((p.y + p.height / 2 - bakedH / 2) / PANORAMA.bakeScale);
    }
    expect(Math.min(...pieces.map((p) => p.centreX))).toBeLessThan(0);
    expect(Math.max(...pieces.map((p) => p.centreX))).toBeGreaterThan(0);
  });

  it('have their own keys per place and weather', () => {
    const keys = new Set([...pieces, ...panoramaPieces('shop', 'rain')].map((p) => p.key));
    expect(keys.size).toBe(pieces.length * 2);
  });
});

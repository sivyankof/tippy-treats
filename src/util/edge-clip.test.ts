import { describe, expect, it } from 'vitest';
import { measureOverflow } from './edge-clip';

function picture(
  width: number,
  height: number,
  drawn: Array<[number, number, number]>,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y, a] of drawn) data[(y * width + x) * 4 + 3] = a;
  return data;
}

const pixelsOf = (o: ReturnType<typeof measureOverflow>): number[] => [
  o.top.pixels,
  o.right.pixels,
  o.bottom.pixels,
  o.left.pixels,
];

describe('measureOverflow', () => {
  it('counts what is drawn in the margin around the field, per side', () => {
    // A 2 x 2 field with a margin of 1: a 4 x 4 picture.
    const data = picture(4, 4, [
      [1, 0, 255],
      [2, 0, 255],
      [0, 1, 255],
      [3, 2, 255],
      [0, 0, 255],
      [1, 1, 255],
    ]);
    expect(pixelsOf(measureOverflow(data, 2, 2, 1))).toEqual([2, 1, 0, 1]);
  });

  it('reports how far the drawing reaches beyond the field', () => {
    // A 2 x 2 field with a margin of 3: the pixel in the outermost column is 3 away.
    const data = picture(8, 8, [
      [0, 3, 255],
      [5, 4, 255],
      [4, 2, 255],
    ]);
    const o = measureOverflow(data, 2, 2, 3);
    expect([o.left.reach, o.right.reach, o.top.reach, o.bottom.reach]).toEqual([3, 1, 1, 0]);
  });

  it('measures the free space to the nearest drawn pixel, negative past the edge', () => {
    // A 4 x 4 field with a margin of 2: the pixel at (2, 3) is on the left edge column... of the field.
    const data = picture(8, 8, [
      [2, 4, 255],
      [5, 3, 255],
      [1, 6, 255],
    ]);
    const o = measureOverflow(data, 4, 4, 2);
    expect(o.left.spare).toBe(-1);
    expect(o.right.spare).toBe(0);
    expect(o.top.spare).toBe(1);
    expect(o.bottom.spare).toBe(-1);
  });

  it('ignores a faint haze at or under the threshold', () => {
    const data = picture(4, 4, [
      [1, 0, 24],
      [2, 0, 25],
    ]);
    expect(measureOverflow(data, 2, 2, 1, 24).top.pixels).toBe(1);
  });

  it('finds nothing when the drawing stays in the field', () => {
    const data = picture(4, 4, [[1, 1, 255]]);
    expect(pixelsOf(measureOverflow(data, 2, 2, 1))).toEqual([0, 0, 0, 0]);
  });
});

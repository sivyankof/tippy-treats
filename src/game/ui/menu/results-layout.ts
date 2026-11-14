import type * as Phaser from 'phaser';

/**
 * Centres of blocks of the given heights stacked top to bottom between `top` and `bottom`.
 * Free room is spread evenly (also above the first and below the last block); the blocks
 * never come closer than `minGap`, and when there is not enough room they overflow downwards.
 */
export function spreadBlocks(
  heights: readonly number[],
  top: number,
  bottom: number,
  minGap: number,
): number[] {
  const n = heights.length;
  if (n === 0) return [];
  const free = bottom - top - heights.reduce((sum, h) => sum + h, 0);
  let gap = free / (n + 1);
  let y = top + gap;
  if (gap < minGap) {
    gap = minGap;
    y = top + Math.max(0, (free - minGap * (n - 1)) / 2);
  }
  return heights.map((h) => {
    const centre = y + h / 2;
    y += h + gap;
    return centre;
  });
}

/** A child of a block together with the height it takes. */
export interface Row {
  obj: Phaser.GameObjects.Text | Phaser.GameObjects.Container;
  height: number;
  /** Horizontal offset from the block centre. */
  x?: number;
}

/**
 * Places `rows` one under another inside `block` (centred on its own origin) with `gap`
 * between them and returns the height of the whole block.
 */
export function stackRows(block: Phaser.GameObjects.Container, rows: readonly Row[], gap: number) {
  const total = rows.reduce((sum, r) => sum + r.height, 0) + gap * Math.max(0, rows.length - 1);
  let y = -total / 2;
  for (const row of rows) {
    row.obj.setPosition(row.x ?? 0, y + row.height / 2);
    block.add(row.obj);
    y += row.height + gap;
  }
  return total;
}

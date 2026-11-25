import type * as Phaser from 'phaser';

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

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

/** What the panel needs to fit above the buttons. */
export interface PanelFit {
  /** Share of the panel's padding and gaps that survives. */
  share: number;
  /** Uniform scale of the whole panel. */
  scale: number;
  /** The missions block is folded into one line. */
  fold: boolean;
}

/** The sizes `fitPanel` works with, all in unscaled units. */
export interface PanelFitInput {
  /** Sum of the block heights. */
  blocksHeight: number;
  /** What the missions block takes less when folded (0: it cannot be folded). */
  foldSaving: number;
  /** Padding and gaps at full share. */
  spacing: number;
  headerHeight: number;
  /** Room for the header and the panel together. */
  room: number;
  minShare: number;
  minScale: number;
  floorScale: number;
}

/** Spacing share and scale for blocks of `blocksHeight`: the spacing shrinks first, then the scale. */
function attemptFit(
  blocksHeight: number,
  { spacing, headerHeight, room, minShare }: PanelFitInput,
): { share: number; scale: number } {
  const free = room - headerHeight;
  if (blocksHeight + spacing * minShare <= free) {
    return { share: spacing <= 0 ? 1 : Math.min(1, (free - blocksHeight) / spacing), scale: 1 };
  }
  return { share: minShare, scale: free / (blocksHeight + spacing * minShare) };
}

/**
 * Chooses how the header and the panel fit into `room`: the spacing shrinks to `minShare` first,
 * then the panel scales down to `minScale`; if that is not enough the missions fold (when they
 * can) and the same is tried again; only then may the scale go below `minScale`, down to
 * `floorScale` (the panel overflows below that). Nothing changes when everything fits.
 */
export function fitPanel(input: PanelFitInput): PanelFit {
  const plain = attemptFit(input.blocksHeight, input);
  if (plain.scale >= input.minScale || input.foldSaving <= 0) {
    return { ...plain, scale: Math.max(input.floorScale, plain.scale), fold: false };
  }
  const folded = attemptFit(input.blocksHeight - input.foldSaving, input);
  return { ...folded, scale: Math.max(input.floorScale, folded.scale), fold: true };
}

/**
 * Widths of the stat cells side by side: each wants its own width, and when together they are
 * wider than `total` they all shrink by the same share.
 */
export function cellWidths(wanted: readonly number[], total: number): number[] {
  const sum = wanted.reduce((a, b) => a + b, 0);
  const share = sum > total ? total / sum : 1;
  return wanted.map((w) => w * share);
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

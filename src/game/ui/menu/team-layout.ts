/** The centre of one card of the team grid. */
export interface GridCell {
  x: number;
  y: number;
}

export interface GridLayout {
  scale: number;
  cells: GridCell[];
  /** Height of the whole grid at this scale. */
  height: number;
}

export interface GridSpec {
  count: number;
  columns: number;
  cardWidth: number;
  cardHeight: number;
  gapX: number;
  gapY: number;
  /** Centre line of the grid. */
  centerX: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
  /** Share of the spare height put above the grid (0 = flush to the top). */
  spareShare: number;
}

/**
 * Places `count` cards in rows of `columns`. The cards (and the gaps) shrink uniformly when the
 * grid would not fit `maxWidth` x `maxHeight`; never above scale 1.
 */
export function layoutGrid(spec: GridSpec): GridLayout {
  const { count, columns, cardWidth, cardHeight, gapX, gapY } = spec;
  const rows = Math.max(1, Math.ceil(count / columns));
  const fullWidth = columns * cardWidth + (columns - 1) * gapX;
  const fullHeight = rows * cardHeight + (rows - 1) * gapY;
  const scale = Math.min(1, spec.maxWidth / fullWidth, spec.maxHeight / fullHeight);
  const stepX = (cardWidth + gapX) * scale;
  const stepY = (cardHeight + gapY) * scale;
  const height = fullHeight * scale;
  const top = spec.top + Math.max(0, spec.maxHeight - height) * spec.spareShare;
  const cells: GridCell[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const rowWidth = (inRow - 1) * stepX;
    cells.push({
      x: spec.centerX - rowWidth / 2 + (i % columns) * stepX,
      y: top + (cardHeight * scale) / 2 + row * stepY,
    });
  }
  return { scale, cells, height };
}

/** Index of the cell under the point, or -1. Cards are `width` x `height` (already scaled). */
export function cellAt(
  cells: readonly GridCell[],
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  return cells.findIndex((c) => Math.abs(x - c.x) <= width / 2 && Math.abs(y - c.y) <= height / 2);
}

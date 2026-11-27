/** A column of items stacked at one gap: where each item starts and how tall the column is. */
export interface Column {
  /** Top y of each item. */
  tops: number[];
  height: number;
}

/** Stacks items of the given heights from y = 0 with `gap` between them. */
export function stackColumn(heights: readonly number[], gap: number): Column {
  const tops: number[] = [];
  let y = 0;
  for (const h of heights) {
    tops.push(y);
    y += h + gap;
  }
  return { tops, height: Math.max(0, y - gap) };
}

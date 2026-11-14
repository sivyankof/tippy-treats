/** Centre x of the slot `index` of `count` slots, relative to the middle of the shelf. */
export function slotX(index: number, count: number, spacing: number): number {
  return (index - (count - 1) / 2) * spacing;
}

/** The slot a tap at `localX` (relative to the middle of the shelf) belongs to. */
export function slotAt(localX: number, count: number, spacing: number): number {
  const index = Math.round(localX / spacing + (count - 1) / 2);
  return Math.max(0, Math.min(count - 1, index));
}

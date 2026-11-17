/** A place handed out by the packer: the top-left corner of a `width` x `height` box. */
export interface PackedBox {
  x: number;
  y: number;
}

interface Span {
  x0: number;
  x1: number;
}

interface Shelf {
  y: number;
  height: number;
  /** Free runs along the shelf, sorted by x and never touching each other. */
  free: Span[];
}

/**
 * Packs boxes into a fixed area in horizontal shelves and takes them back again. A box goes to
 * the lowest shelf that is tall enough and has a free run wide enough, else a new shelf is opened
 * below the last one (its height rounded up to `step`). Freed runs are merged with their
 * neighbours, so boxes of a similar height keep reusing the same shelves.
 */
export class ShelfPacker {
  private readonly shelves: Shelf[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly step: number,
  ) {}

  /** Bottom of the last shelf: the space used so far, top down. */
  get usedHeight(): number {
    const last = this.shelves[this.shelves.length - 1];
    return last ? last.y + last.height : 0;
  }

  /** A place for a box this big, or `null` when it does not fit any more. */
  alloc(width: number, height: number): PackedBox | null {
    if (width <= 0 || height <= 0 || width > this.width || height > this.height) return null;
    const shelfHeight = Math.min(Math.ceil(height / this.step) * this.step, this.height);
    let best: { shelf: Shelf; span: Span } | null = null;
    for (const shelf of this.shelves) {
      if (shelf.height < height) continue;
      // An empty shelf taller than the box is kept for a taller box (or cut down below).
      if (shelf.height > shelfHeight && this.isEmpty(shelf)) continue;
      if (best && best.shelf.height <= shelf.height) continue;
      const span = shelf.free.find((s) => s.x1 - s.x0 >= width);
      if (span) best = { shelf, span };
    }
    if (best) {
      const x = best.span.x0;
      best.span.x0 += width;
      if (best.span.x0 >= best.span.x1)
        best.shelf.free.splice(best.shelf.free.indexOf(best.span), 1);
      return { x, y: best.shelf.y };
    }
    const reused = this.reuseEmpty(shelfHeight);
    if (reused) {
      if (width < this.width) reused.free.push({ x0: width, x1: this.width });
      return { x: 0, y: reused.y };
    }
    const y = this.usedHeight;
    if (y + shelfHeight > this.height) return null;
    const shelf: Shelf = { y, height: shelfHeight, free: [] };
    if (width < this.width) shelf.free.push({ x0: width, x1: this.width });
    this.shelves.push(shelf);
    return { x: 0, y };
  }

  /** Gives back a box handed out by `alloc`. An empty last shelf is closed so its height can be reused. */
  free(box: PackedBox, width: number): void {
    const shelf = this.shelves.find((s) => s.y === box.y);
    if (!shelf) return;
    const run: Span = { x0: box.x, x1: box.x + width };
    const free = shelf.free;
    let i = 0;
    while (i < free.length && (free[i]?.x0 ?? Infinity) < run.x0) i += 1;
    free.splice(i, 0, run);
    const next = free[i + 1];
    if (next && next.x0 <= run.x1) {
      run.x1 = Math.max(run.x1, next.x1);
      free.splice(i + 1, 1);
    }
    const prev = free[i - 1];
    if (prev && prev.x1 >= run.x0) {
      prev.x1 = Math.max(prev.x1, run.x1);
      free.splice(i, 1);
    }
    while (this.isEmptyLast()) this.shelves.pop();
  }

  private isEmptyLast(): boolean {
    const last = this.shelves[this.shelves.length - 1];
    return last !== undefined && this.isEmpty(last);
  }

  private isEmpty(shelf: Shelf): boolean {
    const run = shelf.free[0];
    return shelf.free.length === 1 && run?.x0 === 0 && run.x1 === this.width;
  }

  /**
   * A shelf of `shelfHeight` made from the shortest row of neighbouring empty shelves that is tall
   * enough (the rest of the row stays an empty shelf), or null. Shelves that were emptied one by
   * one are not lost to the boxes of other heights this way.
   */
  private reuseEmpty(shelfHeight: number): Shelf | null {
    let best: { from: number; count: number; total: number } | null = null;
    for (let i = 0; i < this.shelves.length; i++) {
      let total = 0;
      for (let j = i; j < this.shelves.length; j++) {
        const shelf = this.shelves[j];
        if (!shelf || !this.isEmpty(shelf)) break;
        total += shelf.height;
        if (total >= shelfHeight) {
          if (!best || total < best.total) best = { from: i, count: j - i + 1, total };
          break;
        }
      }
    }
    if (!best) return null;
    const first = this.shelves[best.from];
    if (!first) return null;
    const shelf: Shelf = { y: first.y, height: shelfHeight, free: [] };
    const rest = best.total - shelfHeight;
    const replacement: Shelf[] = [shelf];
    if (rest > 0)
      replacement.push({
        y: first.y + shelfHeight,
        height: rest,
        free: [{ x0: 0, x1: this.width }],
      });
    this.shelves.splice(best.from, best.count, ...replacement);
    while (this.isEmptyLast()) this.shelves.pop();
    return shelf;
  }
}

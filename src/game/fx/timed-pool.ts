/** Retire callback for pooled display objects: hides the item. */
export function hideItem(item: { setVisible(visible: boolean): unknown }): void {
  item.setVisible(false);
}

/** A pooled item that lives for a while: `ageMs` runs up to `lifeMs`. */
export interface PoolEntry<V> {
  item: V;
  ageMs: number;
  lifeMs: number;
}

/**
 * Pool of short-lived items (debris, drops): hands out recycled items, ages the live ones
 * and gives expired ones back. Knows nothing about rendering; `retire` hides an item.
 */
export class TimedPool<V, E extends PoolEntry<V>> {
  private readonly live: E[] = [];
  private readonly free: V[] = [];

  constructor(
    private readonly make: () => V,
    private readonly retire: (item: V) => void,
    /** When this many entries are live, the oldest one is retired to make room. */
    private readonly maxLive: number = Infinity,
  ) {}

  get liveCount(): number {
    return this.live.length;
  }

  /** An item to fill in for the next entry: recycled if possible, else made. */
  take(): V {
    if (this.live.length >= this.maxLive) {
      const oldest = this.live.shift();
      if (oldest) this.release(oldest.item);
    }
    return this.free.pop() ?? this.make();
  }

  /** Starts an entry; its item must come from `take()`. */
  add(entry: E): void {
    this.live.push(entry);
  }

  /** Ages every entry by `dtMs`; `step` sees each one that is still alive, with its progress 0..1. */
  update(dtMs: number, step: (entry: E, progress: number) => void): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const entry = this.live[i];
      if (!entry) continue;
      entry.ageMs += dtMs;
      if (entry.ageMs >= entry.lifeMs) {
        this.release(entry.item);
        this.live.splice(i, 1);
        continue;
      }
      step(entry, entry.ageMs / entry.lifeMs);
    }
  }

  /** Retires every live entry. */
  clear(): void {
    this.update(Infinity, () => undefined);
  }

  private release(item: V): void {
    this.retire(item);
    this.free.push(item);
  }
}

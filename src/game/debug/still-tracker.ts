/** What the tracker keeps per watched thing. */
interface Entry {
  /** The values at the last change: new ones are compared against these, not frame to frame, so a slow drift still counts. */
  refs: number[];
  tag: string;
  changedAtMs: number;
  seenFrame: number;
}

/** A rectangle in screen pixels. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Follows lists of numbers (position, scale, angle, ...) and a text tag (frame name, text) of many
 * things over time and tells how long each has stayed the same. A value counts as changed
 * once it differs from the value at the last change by more than its tolerance.
 *
 * Call `beginFrame`, `observe` for every thing that is shown, then `endFrame`: things that were
 * not observed in the frame (hidden, off screen) are forgotten, so a thing that comes back starts
 * a fresh count instead of inheriting the time it spent hidden.
 */
export class StillTracker<K> {
  private readonly entries = new Map<K, Entry>();
  private frame = 0;

  /** `tolerances[i]` is the change of `values[i]` that counts; missing ones mean "any change". */
  constructor(private readonly tolerances: readonly number[] = []) {}

  get size(): number {
    return this.entries.size;
  }

  beginFrame(): void {
    this.frame += 1;
  }

  /** Records the state of `key` at `nowMs` and returns for how long it has been unchanged. */
  observe(key: K, values: readonly number[], tag: string, nowMs: number): number {
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, {
        refs: values.slice(),
        tag,
        changedAtMs: nowMs,
        seenFrame: this.frame,
      });
      return 0;
    }
    entry.seenFrame = this.frame;
    if (this.differs(entry, values, tag)) {
      for (let i = 0; i < values.length; i++) entry.refs[i] = values[i] ?? 0;
      entry.tag = tag;
      entry.changedAtMs = nowMs;
      return 0;
    }
    return Math.max(0, nowMs - entry.changedAtMs);
  }

  /** Starts the count of `key` over, as if it had just appeared (it is hidden or off screen). */
  forget(key: K): void {
    this.entries.delete(key);
  }

  /** Forgets everything that `observe` did not see since `beginFrame`. */
  endFrame(): void {
    for (const [key, entry] of this.entries) {
      if (entry.seenFrame !== this.frame) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private differs(entry: Entry, values: readonly number[], tag: string): boolean {
    if (entry.tag !== tag || entry.refs.length !== values.length) return true;
    for (let i = 0; i < values.length; i++) {
      const tolerance = this.tolerances[i] ?? 0;
      if (Math.abs((values[i] ?? 0) - (entry.refs[i] ?? 0)) > tolerance) return true;
    }
    return false;
  }
}

/**
 * How long an object has been visibly unchanged: it moves when it changes itself or when any
 * container above it does, so the answer is the shortest time since a change along the chain.
 */
export function effectiveStillMs(ownMs: number, parentMs: number): number {
  return Math.min(ownMs, parentMs);
}

/** A world-space rectangle as the camera shows it: moved by the scroll, as far as the object follows it. */
export function toScreenRect(
  bounds: ScreenRect,
  scroll: { x: number; y: number },
  scrollFactor: { x: number; y: number },
): ScreenRect {
  return {
    x: bounds.x - scroll.x * scrollFactor.x,
    y: bounds.y - scroll.y * scrollFactor.y,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Whether a world-space `bounds` rectangle shows in a `viewWidth` x `viewHeight` screen. Unknown
 * bounds (`null`: the object cannot measure itself, like a Graphics) cannot be ruled out, so they
 * count as shown and the object stays in the audit.
 */
export function isOnScreen(
  bounds: ScreenRect | null,
  scroll: { x: number; y: number },
  scrollFactor: { x: number; y: number },
  viewWidth: number,
  viewHeight: number,
): boolean {
  if (!bounds) return true;
  const { x, y, width, height } = toScreenRect(bounds, scroll, scrollFactor);
  return x < viewWidth && y < viewHeight && x + width > 0 && y + height > 0;
}

/** Keeps the longest still time seen for a key, with the latest note about it. */
export class LongestStill<K, N> {
  private readonly longest = new Map<K, { ms: number; note: N }>();

  record(key: K, ms: number, note: N): void {
    const best = this.longest.get(key);
    if (!best || ms >= best.ms) this.longest.set(key, { ms, note });
  }

  /** Everything that stayed still for more than `thresholdMs`, longest first. */
  over(thresholdMs: number): Array<{ ms: number; note: N }> {
    return [...this.longest.values()]
      .filter((entry) => entry.ms > thresholdMs)
      .sort((a, b) => b.ms - a.ms);
  }
}

export interface FrameWorkWatchOptions {
  /** A frame whose work takes longer than this is over budget. */
  budgetMs: number;
  /** The level steps down when this share of the frames of `onWindowMs` is over budget. */
  onShare: number;
  onWindowMs: number;
  /** It steps back up when at most `offBadShare` of the frames of `offWindowMs` took more than budget minus margin. */
  offWindowMs: number;
  offMarginMs: number;
  offBadShare: number;
  /** The level changes at most once in this long (between any two changes). */
  minSwitchGapMs: number;
  /** Frames this long after a return from the background are not counted. */
  resumeIgnoreMs: number;
  /** A gap between frames longer than this is treated as a return from the background. */
  gapMs: number;
  /** The windows are kept as buckets of this length. */
  bucketMs: number;
}

/**
 * Decides from the frame work time (ms spent in update and render) how many steps the effects
 * must be cut by on this device: 0 is full, `maxLevel` the lowest. It moves one step at a time,
 * down after a slow window and up after a calm one. The frame rate is not used: a phone that
 * limits its own rate is not slow. The last frames are kept as counters in a ring of time
 * buckets, so feeding a frame allocates nothing and the windows are checked once per bucket.
 */
export class FrameWorkWatch {
  private readonly size: number;
  private readonly onBuckets: number;
  private readonly offBuckets: number;
  private readonly frames: Int32Array;
  private readonly over: Int32Array;
  private readonly bad: Int32Array;
  /** Absolute index of the bucket being filled; -1 while the history is empty. */
  private head = -1;
  /** Buckets finished since the history was last cleared. */
  private finished = 0;
  private ignoreUntilMs = 0;
  private lastNowMs = -1;
  private lastSwitchMs = Number.NEGATIVE_INFINITY;
  private stepped = 0;
  private floor = 0;

  constructor(
    private readonly options: FrameWorkWatchOptions,
    /** How many steps down there are (2 for full, lite, minimal). */
    private readonly maxLevel = 1,
  ) {
    this.onBuckets = Math.ceil(options.onWindowMs / options.bucketMs);
    this.offBuckets = Math.ceil(options.offWindowMs / options.bucketMs);
    this.size = Math.max(this.onBuckets, this.offBuckets) + 1;
    this.frames = new Int32Array(this.size);
    this.over = new Int32Array(this.size);
    this.bad = new Int32Array(this.size);
  }

  /** Steps the effects are cut by now: 0 while the device keeps up, up to `maxLevel` while it is slow. */
  get level(): number {
    return this.stepped;
  }

  /**
   * The lowest level it may step back up to. Raising it above the current level lifts the level to
   * the floor at once, so the next step down needs a slow window of its own and not the switch gap;
   * lowering it leaves the level where it is until a calm window brings it up.
   */
  setFloor(floor: number): void {
    this.floor = Math.min(Math.max(0, floor), this.maxLevel);
    if (this.stepped < this.floor) {
      this.stepped = this.floor;
      this.clearHistory();
    }
  }

  /** Forgets the recent frames and skips the next `ignoreMs` (a scene was loaded, the app came back). */
  restart(nowMs: number, ignoreMs: number): void {
    this.clearHistory();
    this.ignoreUntilMs = nowMs + ignoreMs;
    this.lastNowMs = nowMs;
  }

  /** Feeds one frame: its work time and the time it ended at. Returns the level. */
  note(workMs: number, nowMs: number): number {
    if (this.lastNowMs >= 0 && nowMs - this.lastNowMs > this.options.gapMs) {
      this.restart(nowMs, this.options.resumeIgnoreMs);
    }
    this.lastNowMs = nowMs;
    if (nowMs < this.ignoreUntilMs) return this.stepped;
    const bucket = Math.floor(nowMs / this.options.bucketMs);
    const rolled = this.advance(bucket);
    const slot = this.head % this.size;
    this.frames[slot] = (this.frames[slot] ?? 0) + 1;
    if (workMs > this.options.budgetMs) this.over[slot] = (this.over[slot] ?? 0) + 1;
    if (workMs > this.options.budgetMs - this.options.offMarginMs) {
      this.bad[slot] = (this.bad[slot] ?? 0) + 1;
    }
    if (rolled && nowMs - this.lastSwitchMs >= this.options.minSwitchGapMs) this.evaluate(nowMs);
    return this.stepped;
  }

  /** Moves the head to `bucket`, clearing the buckets it passes; true when a bucket was finished. */
  private advance(bucket: number): boolean {
    if (this.head < 0) {
      this.head = bucket;
      return false;
    }
    const steps = bucket - this.head;
    if (steps <= 0) return false;
    for (let i = 1; i <= Math.min(steps, this.size); i++)
      this.clearSlot((this.head + i) % this.size);
    this.head = bucket;
    this.finished += steps;
    return true;
  }

  private evaluate(nowMs: number): void {
    if (this.stepped < this.maxLevel && this.finished >= this.onBuckets) {
      const { frames, over } = this.sum(this.over, this.onBuckets);
      if (frames > 0 && over / frames >= this.options.onShare) {
        this.switchTo(this.stepped + 1, nowMs);
        return;
      }
    }
    if (this.stepped > this.floor && this.finished >= this.offBuckets) {
      const { frames, over: bad } = this.sum(this.bad, this.offBuckets);
      if (frames === 0 || bad / frames <= this.options.offBadShare) {
        this.switchTo(this.stepped - 1, nowMs);
      }
    }
  }

  private switchTo(level: number, nowMs: number): void {
    this.stepped = level;
    this.lastSwitchMs = nowMs;
    // The next decision looks at frames of the new level only.
    this.clearHistory();
  }

  /** Frames and counted frames of the last `buckets` finished buckets (the one being filled is left out). */
  private sum(counted: Int32Array, buckets: number): { frames: number; over: number } {
    let frames = 0;
    let over = 0;
    for (let i = 1; i <= buckets; i++) {
      const slot = (((this.head - i) % this.size) + this.size) % this.size;
      frames += this.frames[slot] ?? 0;
      over += counted[slot] ?? 0;
    }
    return { frames, over };
  }

  private clearSlot(slot: number): void {
    this.frames[slot] = 0;
    this.over[slot] = 0;
    this.bad[slot] = 0;
  }

  private clearHistory(): void {
    for (let i = 0; i < this.size; i++) this.clearSlot(i);
    this.head = -1;
    this.finished = 0;
  }
}

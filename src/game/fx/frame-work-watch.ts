export interface FrameWorkWatchOptions {
  /** A frame whose work takes longer than this is over budget. */
  budgetMs: number;
  /** The mode turns on when this share of the frames of `onWindowMs` is over budget. */
  onShare: number;
  onWindowMs: number;
  /** It turns off when at most `offBadShare` of the frames of `offWindowMs` took more than budget minus margin. */
  offWindowMs: number;
  offMarginMs: number;
  offBadShare: number;
  /** The mode changes at most once in this long. */
  minSwitchGapMs: number;
  /** Frames this long after a return from the background are not counted. */
  resumeIgnoreMs: number;
  /** A gap between frames longer than this is treated as a return from the background. */
  gapMs: number;
  /** The windows are kept as buckets of this length. */
  bucketMs: number;
}

/**
 * Decides from the frame work time (ms spent in update and render) whether the device is
 * too slow for full effects. The frame rate is not used: a phone that limits its own rate
 * is not slow. The last frames are kept as counters in a ring of time buckets, so feeding a
 * frame allocates nothing and the windows are checked once per bucket.
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
  private on = false;

  constructor(private readonly options: FrameWorkWatchOptions) {
    this.onBuckets = Math.ceil(options.onWindowMs / options.bucketMs);
    this.offBuckets = Math.ceil(options.offWindowMs / options.bucketMs);
    this.size = Math.max(this.onBuckets, this.offBuckets) + 1;
    this.frames = new Int32Array(this.size);
    this.over = new Int32Array(this.size);
    this.bad = new Int32Array(this.size);
  }

  /** True while the device counts as slow. */
  get reduced(): boolean {
    return this.on;
  }

  /** Forgets the recent frames and skips the next `ignoreMs` (a scene was loaded, the app came back). */
  restart(nowMs: number, ignoreMs: number): void {
    this.clearHistory();
    this.ignoreUntilMs = nowMs + ignoreMs;
    this.lastNowMs = nowMs;
  }

  /** Feeds one frame: its work time and the time it ended at. Returns whether the device counts as slow. */
  note(workMs: number, nowMs: number): boolean {
    if (this.lastNowMs >= 0 && nowMs - this.lastNowMs > this.options.gapMs) {
      this.restart(nowMs, this.options.resumeIgnoreMs);
    }
    this.lastNowMs = nowMs;
    if (nowMs < this.ignoreUntilMs) return this.on;
    const bucket = Math.floor(nowMs / this.options.bucketMs);
    const rolled = this.advance(bucket);
    const slot = this.head % this.size;
    this.frames[slot] = (this.frames[slot] ?? 0) + 1;
    if (workMs > this.options.budgetMs) this.over[slot] = (this.over[slot] ?? 0) + 1;
    if (workMs > this.options.budgetMs - this.options.offMarginMs) {
      this.bad[slot] = (this.bad[slot] ?? 0) + 1;
    }
    if (rolled && nowMs - this.lastSwitchMs >= this.options.minSwitchGapMs) this.evaluate(nowMs);
    return this.on;
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
    if (!this.on) {
      if (this.finished < this.onBuckets) return;
      const { frames, over } = this.sum(this.over, this.onBuckets);
      if (frames > 0 && over / frames >= this.options.onShare) this.switchTo(true, nowMs);
    } else {
      if (this.finished < this.offBuckets) return;
      const { frames, over: bad } = this.sum(this.bad, this.offBuckets);
      if (frames === 0 || bad / frames <= this.options.offBadShare) this.switchTo(false, nowMs);
    }
  }

  private switchTo(on: boolean, nowMs: number): void {
    this.on = on;
    this.lastSwitchMs = nowMs;
    // The next decision looks at frames of the new mode only.
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

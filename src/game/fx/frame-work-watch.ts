/** What made the level step down: the frame work time or the frame interval (GPU). */
export type FrameWorkCause = 'work' | 'gpu';

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
  /** A frame with an interval longer than this and work in budget is late (a 60 Hz vsync was missed). */
  lateIntervalMs: number;
  /** A frame with an interval at most this long is quick (the device can do 60 fps). */
  quickIntervalMs: number;
  /** The level steps down when this share of the frames of `onWindowMs` is late... */
  gpuOnShare: number;
  /** ...and at least this share is quick (a steady 30 fps phone has none, so it never trips). */
  gpuQuickShare: number;
  /** Where the device can do 60 (quick share as above), stepping up also needs at most this share of late frames in `offWindowMs`. */
  gpuOffShare: number;
  /** After a step down by the GPU signal, the level does not step up for this long. */
  gpuUpHoldMs: number;
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
 * down after a slow window and up after a calm one. A second signal is the frame interval while
 * the work is low (a GPU-bound phone): it needs many late frames and also many quick ones, so a
 * phone that limits its own rate (steady 30 fps, 120 Hz) is not slow. The last frames are kept as counters in a ring of time
 * buckets, so feeding a frame allocates nothing and the windows are checked once per bucket.
 */
export class FrameWorkWatch {
  private readonly size: number;
  private readonly onBuckets: number;
  private readonly offBuckets: number;
  private readonly frames: Int32Array;
  private readonly over: Int32Array;
  private readonly bad: Int32Array;
  private readonly late: Int32Array;
  private readonly quick: Int32Array;
  /** Absolute index of the bucket being filled; -1 while the history is empty. */
  private head = -1;
  /** Buckets finished since the history was last cleared. */
  private finished = 0;
  private ignoreUntilMs = 0;
  private lastNowMs = -1;
  private lastSwitchMs = Number.NEGATIVE_INFINITY;
  private stepped = 0;
  private floor = 0;
  private cause: FrameWorkCause = 'work';
  private gpuStepMs = Number.NEGATIVE_INFINITY;

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
    this.late = new Int32Array(this.size);
    this.quick = new Int32Array(this.size);
  }

  /** What caused the last step down: the frame work time or the frame interval (GPU). */
  get lastCause(): FrameWorkCause {
    return this.cause;
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
    const intervalMs = this.lastNowMs >= 0 ? nowMs - this.lastNowMs : 0;
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
    if (intervalMs > 0) {
      if (intervalMs > this.options.lateIntervalMs && workMs <= this.options.budgetMs) {
        this.late[slot] = (this.late[slot] ?? 0) + 1;
      }
      if (intervalMs <= this.options.quickIntervalMs)
        this.quick[slot] = (this.quick[slot] ?? 0) + 1;
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
        this.switchTo(this.stepped + 1, nowMs, 'work');
        return;
      }
      const lateFrames = this.sum(this.late, this.onBuckets);
      if (
        lateFrames.frames > 0 &&
        lateFrames.over / lateFrames.frames >= this.options.gpuOnShare &&
        this.sum(this.quick, this.onBuckets).over / lateFrames.frames >= this.options.gpuQuickShare
      ) {
        this.switchTo(this.stepped + 1, nowMs, 'gpu');
        return;
      }
    }
    if (this.stepped > this.floor && this.finished >= this.offBuckets) {
      const { frames, over: bad } = this.sum(this.bad, this.offBuckets);
      const held = nowMs - this.gpuStepMs < this.options.gpuUpHoldMs;
      if (!held && (frames === 0 || bad / frames <= this.options.offBadShare)) {
        // Late frames hold it down only where the device can do 60 (a steady 30 fps phone is all late).
        const late = this.sum(this.late, this.offBuckets).over;
        const quick = this.sum(this.quick, this.offBuckets).over;
        const canDo60 = frames > 0 && quick / frames >= this.options.gpuQuickShare;
        if (frames === 0 || !canDo60 || late / frames <= this.options.gpuOffShare) {
          this.switchTo(this.stepped - 1, nowMs, this.cause);
        }
      }
    }
  }

  private switchTo(level: number, nowMs: number, cause: FrameWorkCause): void {
    if (level > this.stepped) {
      this.cause = cause;
      if (cause === 'gpu') this.gpuStepMs = nowMs;
    }
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
    this.late[slot] = 0;
    this.quick[slot] = 0;
  }

  private clearHistory(): void {
    for (let i = 0; i < this.size; i++) this.clearSlot(i);
    this.head = -1;
    this.finished = 0;
  }
}

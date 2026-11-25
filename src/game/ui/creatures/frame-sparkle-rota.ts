/** One gold frame as the rota sees it. */
export interface SparkleFrame {
  /** True while the frame is on the screen and can be seen (alive, shown, opaque, inside the view). */
  isShown(): boolean;
  /** Shows the glint at `progress` (0..1) of its way round the frame. */
  show(progress: number): void;
  /** Hides the glint. */
  hide(): void;
}

/** The numbers of the rota: the start-to-start period, the length of one run, the wait before the first one. */
export interface SparkleTiming {
  periodMs: number;
  runMs: number;
  firstDelayMs: number;
}

/**
 * Lets one gold frame at a time run its sparkle: every period the next shown frame in registration order
 * (round-robin) runs once; frames that are hidden are skipped. Driven by `update`, so it owns no timers.
 * At the minimal effects level nothing runs.
 */
export class FrameSparkleRota {
  private readonly frames: SparkleFrame[] = [];
  private waitMs: number;
  private running: SparkleFrame | null = null;
  private elapsedMs = 0;
  /** Index of the frame that ran last; the search for the next one starts after it. */
  private last = -1;

  constructor(
    private readonly timing: SparkleTiming,
    private readonly isReduced: () => boolean,
  ) {
    this.waitMs = timing.firstDelayMs;
  }

  /** Adds a frame; the returned function removes it again. */
  register(frame: SparkleFrame): () => void {
    this.frames.push(frame);
    return () => this.unregister(frame);
  }

  unregister(frame: SparkleFrame): void {
    const i = this.frames.indexOf(frame);
    if (i < 0) return;
    this.frames.splice(i, 1);
    if (i <= this.last) this.last--;
    // A frame gone mid-run (its card destroyed) still keeps the pause before the next one.
    if (this.running === frame) this.finish(frame);
  }

  /** The frame that runs its sparkle now. */
  get active(): SparkleFrame | null {
    return this.running;
  }

  /** Stops the sparkle that runs and forgets every frame. */
  clear(): void {
    this.running?.hide();
    this.running = null;
    this.frames.length = 0;
    this.last = -1;
  }

  update(deltaMs: number): void {
    const run = this.running;
    if (run) {
      if (this.isReduced() || !run.isShown()) {
        this.finish(run);
        return;
      }
      this.elapsedMs += deltaMs;
      if (this.elapsedMs >= this.timing.runMs) this.finish(run);
      else run.show(this.elapsedMs / this.timing.runMs);
      return;
    }
    if (this.isReduced()) return;
    this.waitMs = Math.max(0, this.waitMs - deltaMs);
    if (this.waitMs > 0) return;
    const next = this.pickNext();
    if (!next) return;
    this.running = next;
    this.elapsedMs = 0;
    next.show(0);
  }

  private finish(frame: SparkleFrame): void {
    frame.hide();
    this.running = null;
    this.waitMs = Math.max(0, this.timing.periodMs - this.timing.runMs);
  }

  private pickNext(): SparkleFrame | null {
    const n = this.frames.length;
    for (let step = 1; step <= n; step++) {
      const i = (((this.last + step) % n) + n) % n;
      const frame = this.frames[i];
      if (frame?.isShown()) {
        this.last = i;
        return frame;
      }
    }
    return null;
  }
}

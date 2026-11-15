export interface FrameWorkStatsOptions {
  /** How many of the latest frames are kept. */
  frames: number;
  /** Share of frames at or below the reported value, 0..1. */
  percentile: number;
  /** The percentile is recomputed every this many frames. */
  refreshFrames: number;
}

/** Average and percentile of the frame work time over the latest frames; no allocations per frame. */
export class FrameWorkStats {
  private readonly ring: Float32Array;
  private readonly scratch: Float32Array;
  private next = 0;
  private count = 0;
  private sum = 0;
  private sinceRefresh = 0;
  private cachedPercentile = 0;

  constructor(private readonly options: FrameWorkStatsOptions) {
    this.ring = new Float32Array(options.frames);
    this.scratch = new Float32Array(options.frames);
  }

  add(workMs: number): void {
    const dropped = this.count === this.ring.length ? (this.ring[this.next] ?? 0) : 0;
    this.sum += workMs - dropped;
    this.ring[this.next] = workMs;
    this.next = (this.next + 1) % this.ring.length;
    if (this.count < this.ring.length) this.count++;
    this.sinceRefresh++;
  }

  get average(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  /** The percentile of the kept frames (refreshed every `refreshFrames` frames). */
  get percentile(): number {
    if (this.sinceRefresh >= this.options.refreshFrames || this.cachedPercentile === 0) {
      this.sinceRefresh = 0;
      this.cachedPercentile = this.compute();
    }
    return this.cachedPercentile;
  }

  private compute(): number {
    if (this.count === 0) return 0;
    const sorted = this.scratch.subarray(0, this.count);
    sorted.set(this.ring.subarray(0, this.count));
    sorted.sort();
    const index = Math.min(this.count - 1, Math.ceil(this.count * this.options.percentile) - 1);
    return sorted[Math.max(0, index)] ?? 0;
  }
}

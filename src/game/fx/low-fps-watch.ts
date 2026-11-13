import { MS_PER_SECOND } from '../../util/math';

export interface LowFpsWatchOptions {
  /** Frame rate that counts as too low. */
  lowFps: number;
  /** How long the average has to stay below `lowFps`. */
  windowMs: number;
  /** A longer frame is a one-off hitch: it restarts the window instead of counting. */
  hitchMs: number;
}

/**
 * Watches frame lengths and reports when the average frame rate over the last
 * `windowMs` stayed below `lowFps`. Averaging over the window keeps single slow
 * frames (a texture bake, garbage collection) from tripping it.
 */
export class LowFpsWatch {
  private readonly frames: number[] = [];
  private sumMs = 0;

  constructor(private readonly options: LowFpsWatchOptions) {}

  /** Feeds the length of one frame; true while the window is full and too slow. */
  update(deltaMs: number): boolean {
    if (deltaMs <= 0) return false;
    if (deltaMs > this.options.hitchMs) {
      this.reset();
      return false;
    }
    this.frames.push(deltaMs);
    this.sumMs += deltaMs;
    // Keep just enough of the newest frames to cover the window.
    let oldest = this.frames[0];
    while (
      oldest !== undefined &&
      this.frames.length > 1 &&
      this.sumMs - oldest >= this.options.windowMs
    ) {
      this.frames.shift();
      this.sumMs -= oldest;
      oldest = this.frames[0];
    }
    if (this.sumMs < this.options.windowMs) return false;
    return (this.frames.length * MS_PER_SECOND) / this.sumMs < this.options.lowFps;
  }

  reset(): void {
    this.frames.length = 0;
    this.sumMs = 0;
  }
}

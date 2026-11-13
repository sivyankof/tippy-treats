import { bump } from './anim-curves';

/**
 * A short out-and-back push of the view: sin(pi * t) over the duration.
 * Positive offsets move the view down. A new kick replaces the running one.
 * Not Phaser's camera shake: that one is random in both directions.
 */
export class CameraKick {
  private amplitude = 0;
  private durationMs = 0;
  private elapsedMs = 0;

  kick(px: number, durationMs: number): void {
    this.amplitude = px;
    this.durationMs = durationMs;
    this.elapsedMs = 0;
  }

  update(dtMs: number): void {
    if (this.durationMs <= 0) return;
    this.elapsedMs += dtMs;
    if (this.elapsedMs >= this.durationMs) this.durationMs = 0;
  }

  /** Current push in pixels; 0 when idle. */
  get offset(): number {
    if (this.durationMs <= 0) return 0;
    return this.amplitude * bump(this.elapsedMs / this.durationMs);
  }
}

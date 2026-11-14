import { clamp01 } from '../../util/math';

/** Opacity of something shown for `totalMs`: fades in over `inMs`, fades out over the last `outMs`. */
export function fadeAlpha(elapsedMs: number, totalMs: number, inMs: number, outMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= totalMs) return 0;
  const up = inMs > 0 ? elapsedMs / inMs : 1;
  const down = outMs > 0 ? (totalMs - elapsedMs) / outMs : 1;
  return clamp01(Math.min(up, down));
}

/** A one-shot timer for a hint that runs on its own (not on the hold of the sim). */
export class HintClock {
  private elapsedMs = 0;
  private totalMs = 0;

  start(totalMs: number): void {
    this.elapsedMs = 0;
    this.totalMs = totalMs;
  }

  stop(): void {
    this.totalMs = 0;
  }

  tick(dtMs: number): void {
    if (this.active) this.elapsedMs += dtMs;
  }

  get active(): boolean {
    return this.elapsedMs < this.totalMs;
  }

  get elapsed(): number {
    return this.elapsedMs;
  }

  get total(): number {
    return this.totalMs;
  }

  alpha(inMs: number, outMs: number): number {
    return fadeAlpha(this.elapsedMs, this.totalMs, inMs, outMs);
  }
}

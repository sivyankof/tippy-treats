import { pickRange } from '../../../util/math';

type Range = readonly [number, number];

export interface PassTimerSpec {
  moveMs: Range;
  /** Time from the start of one pass to the start of the next; a pass is never cut short by it. */
  intervalMs: Range;
  /** Wait before the first pass; a negative value starts that far into it. */
  initialDelayMs: Range;
}

/**
 * Clock of something that crosses the screen now and then: a pass of `moveMs`, then a
 * rest, until the next pass starts `intervalMs` after the previous one started.
 * After `update`, `active` says whether a pass is running and `progress` is how far
 * (0..1); `started` is true for the frame a new pass began in.
 */
export class PassTimer {
  active = false;
  progress = 0;
  started = false;
  private clockMs: number;
  private moveMs = 0;
  private cycleMs = 0;

  constructor(
    private readonly spec: PassTimerSpec,
    private readonly random: () => number = Math.random,
  ) {
    this.clockMs = -pickRange(spec.initialDelayMs, random);
    this.beginCycle();
    // A negative delay starts inside the first pass.
    this.active = this.clockMs >= 0;
  }

  private beginCycle(): void {
    this.moveMs = pickRange(this.spec.moveMs, this.random);
    this.cycleMs = Math.max(this.moveMs, pickRange(this.spec.intervalMs, this.random));
  }

  update(deltaMs: number): void {
    this.started = false;
    const before = this.clockMs;
    this.clockMs += deltaMs;
    while (this.clockMs >= this.cycleMs) {
      this.clockMs -= this.cycleMs;
      this.beginCycle();
      this.started = true;
    }
    if (before < 0 && this.clockMs >= 0) this.started = true;
    this.active = this.clockMs >= 0 && this.clockMs < this.moveMs;
    this.progress = this.active ? this.clockMs / this.moveMs : 0;
  }
}

/** 0 at both ends of a pass, 1 in the middle, rising and falling over `edge` of the pass at each end. */
export function edgeFade(progress: number, edge: number): number {
  if (edge <= 0) return 1;
  return Math.min(1, progress / edge, (1 - progress) / edge);
}

import { LOOP_WATCH } from '../../../data/app/loop-watch';

/** What the watchdog decides at a check. */
export type LoopVerdict = 'ok' | 'restart' | 'give-up';

/** The limits of the watchdog (`LOOP_WATCH`, or others in a test). */
export interface LoopLimits {
  stallMs: number;
  lateMs: number;
  restartsMax: number;
  restartGapMs: number;
}

/**
 * Decides when the frame loop is dead (a pure state machine: the clock and the frame counter are
 * passed in). `active` is false while the loop is meant to stand still (hidden page, the app in
 * the background, a loop put to sleep): the count starts over then.
 */
export class LoopWatch {
  private lastFrame = -1;
  private lastChangeAt = 0;
  private lastCheckAt: number | null = null;
  private lastRestartAt: number | null = null;
  private restarts = 0;
  private gaveUp = false;
  private wasActive = false;

  constructor(private readonly limits: LoopLimits = LOOP_WATCH) {}

  get restartCount(): number {
    return this.restarts;
  }

  check(now: number, frame: number, active: boolean): LoopVerdict {
    if (this.gaveUp) return 'ok';
    const late = this.lastCheckAt !== null && now - this.lastCheckAt > this.limits.lateMs;
    this.lastCheckAt = now;
    const resumed = active && !this.wasActive;
    this.wasActive = active;
    if (!active || resumed || late || frame !== this.lastFrame) {
      this.lastFrame = frame;
      this.lastChangeAt = now;
      return 'ok';
    }
    if (now - this.lastChangeAt < this.limits.stallMs) return 'ok';
    if (this.restarts >= this.limits.restartsMax) {
      this.gaveUp = true;
      return 'give-up';
    }
    if (this.lastRestartAt !== null && now - this.lastRestartAt < this.limits.restartGapMs) {
      return 'ok';
    }
    this.restarts++;
    this.lastRestartAt = now;
    this.lastChangeAt = now;
    return 'restart';
  }
}

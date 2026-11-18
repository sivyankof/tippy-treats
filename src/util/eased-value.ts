import { stepToward } from './math';

/**
 * A number shown on the screen that follows its target over time: each step moves it by at most `deltaMs / easeMs`
 * (a full 0..1 swing takes `easeMs`). The first target is taken as it is, so nothing eases in on the first frame.
 */
export class EasedValue {
  private now = 0;
  private started = false;

  constructor(private readonly easeMs: number) {}

  /** The value shown now (0 before the first `follow`). */
  get value(): number {
    return this.now;
  }

  /** Moves towards `target` for a frame of `deltaMs` and returns the new value. */
  follow(target: number, deltaMs: number): number {
    this.now = this.started ? stepToward(this.now, target, deltaMs / this.easeMs) : target;
    this.started = true;
    return this.now;
  }
}

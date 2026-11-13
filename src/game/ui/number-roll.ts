import { ANIM } from '../../data/anim';

/** Roll length for a change of `change`: the shortest for 1, the longest from `numberRollBigChange` on. */
export function rollDurationMs(change: number): number {
  const [minMs, maxMs] = ANIM.ui.numberRollMs;
  const size = Math.abs(change);
  if (size <= 1) return minMs;
  const t = Math.min(1, Math.log10(size) / Math.log10(ANIM.ui.numberRollBigChange));
  return minMs + (maxMs - minMs) * t;
}

/** Fast start, soft landing on the target. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * A whole number shown on screen that rolls to each new value instead of jumping.
 * The first value appears at once; a new target mid-roll continues from what is shown.
 */
export class NumberRoll {
  private from = 0;
  private to = 0;
  private elapsedMs = 0;
  private durationMs = 0;
  private started = false;

  /** The number to show now. */
  get shown(): number {
    if (this.elapsedMs >= this.durationMs) return this.to;
    const t = easeOutCubic(this.elapsedMs / this.durationMs);
    return Math.round(this.from + (this.to - this.from) * t);
  }

  /** Rolls towards `target`; `snap` (and the very first value) shows it at once. */
  set(target: number, snap = false): void {
    if (snap || !this.started) {
      this.started = true;
      this.from = this.to = target;
      this.elapsedMs = this.durationMs = 0;
      return;
    }
    if (target === this.to) return;
    this.from = this.shown;
    this.to = target;
    this.elapsedMs = 0;
    this.durationMs = rollDurationMs(target - this.from);
  }

  /** Advances the roll and returns the number to show. */
  update(dtMs: number): number {
    this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + dtMs);
    return this.shown;
  }
}

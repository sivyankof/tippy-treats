import { lapFirstIndex, flyingLap } from '../../../core/space-laps';
import { zoneStartIndex } from '../../../core/zones';
import { ZONES } from '../../../data/zones/zones';

/** What the backdrop gets ready ahead of the change: the next zone, or in Space the next lap's planet. */
export type PrepTarget = { kind: 'zone'; index: number } | { kind: 'lap'; lap: number };

/**
 * What to prepare at a tower height: the next zone once `height` is within `lead` layers of the
 * height its first layer flies at (in Space: the next lap), `null` before that.
 */
export function prepTarget(height: number, zoneIndex: number, lead: number): PrepTarget | null {
  if (zoneIndex < ZONES.length - 1) {
    const changeAt = zoneStartIndex(zoneIndex + 1) - 1;
    return height >= changeAt - lead ? { kind: 'zone', index: zoneIndex + 1 } : null;
  }
  const lap = Math.max(flyingLap(height), 1) + 1;
  const changeAt = lapFirstIndex(lap) - 1;
  return height >= changeAt - lead ? { kind: 'lap', lap } : null;
}

export function sameTarget(a: PrepTarget | null, b: PrepTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === 'zone'
    ? b.kind === 'zone' && a.index === b.index
    : b.kind === 'lap' && a.lap === b.lap;
}

export type PrepStep = () => void;

/**
 * Steps of work spread over frames: each frame runs the first waiting step and then more while the
 * time used plus the longest step seen so far in this prep (forgotten when the queue empties) stays within the budget, so a frame never takes much
 * more than the budget for them (a single step longer than it still runs, alone).
 */
export class PrepQueue {
  private steps: PrepStep[] = [];
  private next = 0;
  private longestMs = 0;

  /** Steps still to run. */
  get pending(): number {
    return this.steps.length - this.next;
  }

  add(steps: readonly PrepStep[]): void {
    this.steps.push(...steps);
  }

  /** Runs this frame's share; returns how many steps ran. `now` is a clock in ms. */
  work(budgetMs: number, now: () => number): number {
    const startMs = now();
    let ran = 0;
    while (this.next < this.steps.length) {
      const before = now();
      if (ran > 0 && before - startMs + this.longestMs > budgetMs) break;
      this.runNext();
      this.longestMs = Math.max(this.longestMs, now() - before);
      ran++;
    }
    this.trim();
    return ran;
  }

  /** Runs every waiting step now (the change came before the work was done). */
  flush(): void {
    while (this.next < this.steps.length) this.runNext();
    this.trim();
  }

  /** Drops the waiting steps. */
  clear(): void {
    this.steps = [];
    this.next = 0;
    // The longest step belongs to the work that is over: the next prep starts without it.
    this.longestMs = 0;
  }

  private runNext(): void {
    const step = this.steps[this.next++];
    step?.();
  }

  private trim(): void {
    if (this.next < this.steps.length) return;
    this.clear();
  }
}

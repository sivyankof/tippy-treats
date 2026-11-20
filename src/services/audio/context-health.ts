import { CONTEXT_HEALTH } from '../../data/audio/context-health';
import { MS_PER_SECOND } from '../../util/math';

/** A step of the way back for a context whose clock stands. */
export type HealthStep = 'resume' | 'bounce' | 'remake';

/** What one look at the context saw. */
export interface ContextLook {
  nowMs: number;
  /** `AudioContext.currentTime`, seconds. */
  clockSec: number;
  /** Something holds the sound (the app is in the background): the check waits. */
  held: boolean;
}

/** The answer of one look. */
export type HealthVerdict =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'alive' }
  | { kind: 'step'; step: HealthStep }
  | { kind: 'given-up' };

type Ladder = readonly { atMs: number; step: HealthStep }[];

export interface HealthConfig {
  aliveMs: number;
  minRate: number;
  minStepGapMs: number;
  ladder: Ladder;
}

/**
 * Whether a suspect context really runs (docs/06, section 7, "Проверка контекста"). The state
 * `running` proves nothing: after a return from the background an iPhone context said `running`
 * while its clock stood. A context is suspect after it is made, after a return to the app, after a
 * refused `resume()` and after `interrupted`; it is alive once its clock has kept going for
 * `aliveMs`. Until then the ladder's steps come due one by one (ask to run, stop and start, make
 * again). While the sound is held the check stands, and starts over once it is let go.
 */
export class ContextHealth {
  private suspect = false;
  /** When the ladder started (null while held). */
  private startMs: number | null = null;
  private nextStep = 0;
  private lastStepMs: number | null = null;
  private last: { nowMs: number; clockSec: number } | null = null;
  private goingMs = 0;
  /** The clock was going at the last look (null before any look). */
  running: boolean | null = null;

  constructor(private readonly cfg: HealthConfig = CONTEXT_HEALTH) {}

  get isSuspect(): boolean {
    return this.suspect;
  }

  /** The context may not run: the check starts (again) from the first step. */
  suspectNow(): void {
    this.suspect = true;
    this.startMs = null;
    this.nextStep = 0;
    this.lastStepMs = null;
    this.last = null;
    this.goingMs = 0;
  }

  /** A new context: the clock is learnt again. */
  forget(): void {
    this.suspect = false;
    this.startMs = null;
    this.nextStep = 0;
    this.lastStepMs = null;
    this.last = null;
    this.goingMs = 0;
    this.running = null;
  }

  look({ nowMs, clockSec, held }: ContextLook): HealthVerdict {
    const prev = this.last;
    this.last = { nowMs, clockSec };
    if (prev && nowMs > prev.nowMs) {
      const wallSec = (nowMs - prev.nowMs) / MS_PER_SECOND;
      const going = clockSec - prev.clockSec >= wallSec * this.cfg.minRate;
      this.goingMs = going ? this.goingMs + (nowMs - prev.nowMs) : 0;
      this.running = going;
    }
    if (!this.suspect) return { kind: 'idle' };
    if (held) {
      this.startMs = null;
      this.nextStep = 0;
      this.lastStepMs = null;
      return { kind: 'waiting' };
    }
    if (this.goingMs >= this.cfg.aliveMs) {
      this.suspect = false;
      return { kind: 'alive' };
    }
    this.startMs ??= nowMs;
    const due = this.cfg.ladder[this.nextStep];
    if (!due) {
      this.suspect = false;
      return { kind: 'given-up' };
    }
    if (nowMs - this.startMs < due.atMs) return { kind: 'waiting' };
    if (this.lastStepMs !== null && nowMs - this.lastStepMs < this.cfg.minStepGapMs) {
      return { kind: 'waiting' };
    }
    this.lastStepMs = nowMs;
    this.nextStep += 1;
    return { kind: 'step', step: due.step };
  }
}

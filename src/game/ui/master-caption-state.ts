import type { SimEvent } from '../../core/tower-sim';
import type { CreatureId } from '../../data/creatures/creatures';
import { MASTER_ANIM } from '../../data/creatures/master-anim';
import type { EaseFn } from '../fx/ease';

const cfg = MASTER_ANIM.caption;

/** One master effect that acted: whose. The coins it paid fly to the coin counter of the HUD. */
export interface MasterNote {
  creature: CreatureId;
}

const FEED_CAP = 16;

/**
 * The master effects of the run waiting for the HUD. The run scene fills it from the sim events,
 * the HUD drains it every frame. Bounded and reused, so it allocates nothing during the run.
 */
export class MasterFeed {
  private readonly notes: MasterNote[] = [];
  private count = 0;

  /** Notes the `mastery` events of one sim step. */
  take(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'mastery') this.push(event.creature);
    }
  }

  push(creature: CreatureId): void {
    if (this.count >= FEED_CAP) return;
    const note = (this.notes[this.count] ??= { creature });
    note.creature = creature;
    this.count++;
  }

  /** Hands every waiting note to `visit` and empties the feed. */
  drain(visit: (note: Readonly<MasterNote>) => void): void {
    const count = this.count;
    this.count = 0;
    for (let i = 0; i < count; i++) {
      const note = this.notes[i];
      if (note) visit(note);
    }
  }

  clear(): void {
    this.count = 0;
  }
}

export type CaptionPhase = 'idle' | 'in' | 'hold' | 'out';

/** The show of one creature's caption: its phase and its age in the phase. */
export interface CaptionState {
  phase: CaptionPhase;
  ageMs: number;
}

export function idleCaption(): CaptionState {
  return { phase: 'idle', ageMs: 0 };
}

/**
 * A master effect acted. A caption that is not showing (or is fading out) starts over and returns
 * true: it may spark. One that is showing is extended to a fresh hold and returns false: a
 * creature that acts again and again (the meringue at every cloud) keeps one caption instead of a
 * stream of them.
 */
export function noteCaption(state: CaptionState): boolean {
  const fresh = state.phase === 'idle' || state.phase === 'out';
  if (fresh) {
    state.phase = 'in';
    state.ageMs = 0;
  } else if (state.phase === 'hold') {
    state.ageMs = 0;
  }
  return fresh;
}

/** Ends a caption at once (a newer one of another creature replaces it). */
export function endCaption(state: CaptionState): void {
  state.phase = 'idle';
  state.ageMs = 0;
}

/** Advances a caption by `dtMs`. */
export function stepCaption(state: CaptionState, dtMs: number): void {
  if (state.phase === 'idle') return;
  state.ageMs += dtMs;
  if (state.phase === 'in' && state.ageMs >= cfg.inMs) {
    state.phase = 'hold';
    state.ageMs = 0;
  }
  if (state.phase === 'hold' && state.ageMs >= cfg.holdMs) {
    state.phase = 'out';
    state.ageMs = 0;
  }
  if (state.phase === 'out' && state.ageMs >= cfg.outMs) {
    state.phase = 'idle';
    state.ageMs = 0;
  }
}

export interface CaptionLook {
  scale: number;
  alpha: number;
}

/** Scale and opacity of a caption; `plain` (the minimal level) only fades, without the pop. */
export function captionLook(
  state: Readonly<CaptionState>,
  plain: boolean,
  inEase: EaseFn,
  out: CaptionLook,
): CaptionLook {
  out.scale = 1;
  out.alpha = 0;
  switch (state.phase) {
    case 'in': {
      const k = Math.min(1, state.ageMs / cfg.inMs);
      out.alpha = plain ? k : Math.min(1, k * 2);
      out.scale = plain ? 1 : cfg.fromScale + (1 - cfg.fromScale) * inEase(k);
      break;
    }
    case 'hold':
      out.alpha = 1;
      break;
    case 'out':
      out.alpha = 1 - Math.min(1, state.ageMs / cfg.outMs);
      break;
    default:
      break;
  }
  return out;
}

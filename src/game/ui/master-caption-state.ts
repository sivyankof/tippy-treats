import type { SimEvent } from '../../core/tower-sim';
import type { CreatureId } from '../../data/creatures';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { LOGICAL_SIZE } from '../../data/screen';
import { MASTER_ANIM } from '../../data/master-anim';
import type { EaseFn } from '../fx/ease';

const cfg = MASTER_ANIM.caption;

/** One master effect that acted: who, and the coins it paid (the plate shows their sum). */
export interface MasterNote {
  creature: CreatureId;
  coins: number;
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
      if (event.type === 'mastery') this.push(event.creature, event.coins);
    }
  }

  push(creature: CreatureId, coins: number): void {
    if (this.count >= FEED_CAP) return;
    const note = (this.notes[this.count] ??= { creature, coins });
    note.creature = creature;
    note.coins = coins;
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

/** The show of one creature's caption: its phase, its age in the phase and the coin sum. */
export interface CaptionState {
  phase: CaptionPhase;
  ageMs: number;
  coins: number;
}

export function idleCaption(): CaptionState {
  return { phase: 'idle', ageMs: 0, coins: 0 };
}

/**
 * A master effect acted. A caption that is not showing (or is fading out) starts over with this
 * payout and returns true: it may spark. One that is showing is extended to a fresh hold and its
 * sum grows, and returns false: a creature that acts again and again (the meringue at every
 * cloud) keeps one caption instead of a stream of them.
 */
export function noteCaption(state: CaptionState, coins: number): boolean {
  const fresh = state.phase === 'idle' || state.phase === 'out';
  if (fresh) {
    state.phase = 'in';
    state.ageMs = 0;
    state.coins = coins;
  } else {
    state.coins += coins;
    if (state.phase === 'hold') state.ageMs = 0;
  }
  return fresh;
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
    state.coins = 0;
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

export interface CaptionPlace {
  /** Left edge of the plate. */
  left: number;
  /** Centre y of the plate. */
  y: number;
}

const { badgeSize, badgeGap, badgeMargin, badgeRowY } = HUD_LAYOUT;

/** Centre x of the badge at `index` of the row when it has settled. */
export function badgeCentreX(index: number): number {
  return badgeMargin + badgeSize / 2 + index * (badgeSize + badgeGap);
}

/**
 * Where a caption of `width` goes. `badgeIndex` is the place of the creature's badge in the row,
 * or -1 when it has none (the plate then takes the first place of the row, so any other badge
 * is "after" it); `badgeCount` is the badges in the row. Right of its badge when nothing follows
 * it and the plate ends clear of the next creature indicator; in the first place of an empty
 * row; otherwise under the row.
 */
export function captionPlace(
  badgeIndex: number,
  badgeCount: number,
  width: number,
  out: CaptionPlace,
  screenWidth: number = LOGICAL_SIZE.width,
): CaptionPlace {
  const hasBadge = badgeIndex >= 0;
  const left = badgeCentreX(Math.max(0, badgeIndex)) - badgeSize / 2;
  const followed = hasBadge ? badgeIndex < badgeCount - 1 : badgeCount > 0;
  const plateLeft = hasBadge ? left + badgeSize + cfg.gap : left;
  const fits = plateLeft + width <= screenWidth - cfg.rightReserve;
  if (!followed && fits) {
    out.left = plateLeft;
    out.y = badgeRowY;
  } else {
    out.left = left;
    out.y = cfg.belowY;
  }
  return out;
}

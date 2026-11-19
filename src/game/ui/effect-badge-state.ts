import type { ActiveEffect } from '../../core/abilities/types';
import { ANIM } from '../../data/common/anim';
import type { CreatureId } from '../../data/creatures/creatures';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { oscillate01 } from '../../util/math';
import type { EaseFn } from '../fx/common/ease';

/** A badge shows an effect by its creature id, or the brownie shield. */
export type BadgeKey = CreatureId | 'shield';

/** The creature whose icon a badge shows (the shield is the brownie's). */
export function badgeCreature(key: BadgeKey): CreatureId {
  return key === 'shield' ? 'brownie' : key;
}

/** Centre x of the badge at `index` of the row once it has settled. */
export function badgeCentreX(index: number): number {
  const { badgeMargin, badgeSize, badgeGap } = HUD_LAYOUT;
  return badgeMargin + badgeSize / 2 + index * (badgeSize + badgeGap);
}

export type BadgePhase = 'in' | 'live' | 'out';

/** One badge of the effect row. The tracker mutates these objects in place. */
export interface BadgeState {
  key: BadgeKey;
  layersLeft: number;
  /** A mastery tail (jelly, frosty): the badge wears a gold dot. */
  tail: boolean;
  phase: BadgePhase;
  /** Time in the current phase. */
  ageMs: number;
  /** Time since the counter last changed; `Infinity` when it has not. */
  counterAgeMs: number;
  /** Where the view draws the badge (centre x); `NaN` until it was first placed. */
  x: number;
  /** The tracker saw the effect in the latest sync. */
  seen: boolean;
}

/** How a badge looks at a moment; written by `badgeVisual` into a reused object. */
export interface BadgeVisual {
  scale: number;
  alpha: number;
}

const { badges } = ANIM;

/**
 * Keeps the badges of the active effects in step with the run: one badge per effect (and one
 * for the shield) in the order they appeared; a finished effect keeps its badge while it
 * shrinks out. Pure bookkeeping, no rendering.
 */
export class BadgeTracker {
  /** Badges in display order; the array and its objects are reused. */
  readonly items: BadgeState[] = [];

  /** Brings the badges in line with the effects and the shield. */
  sync(effects: readonly ActiveEffect[], shield: number): void {
    for (const badge of this.items) badge.seen = false;
    for (const effect of effects) this.note(effect.id, effect.layersLeft, effect.tail === true);
    if (shield > 0) this.note('shield', shield, false);
    for (const badge of this.items) {
      if (!badge.seen && badge.phase !== 'out') this.setPhase(badge, 'out');
    }
  }

  /** Advances the phases and drops badges that have shrunk away. Returns true when one was dropped. */
  step(dtMs: number): boolean {
    let dropped = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const badge = this.items[i];
      if (!badge) continue;
      badge.ageMs += dtMs;
      badge.counterAgeMs += dtMs;
      if (badge.phase === 'in' && badge.ageMs >= badges.inMs) this.setPhase(badge, 'live');
      else if (badge.phase === 'out' && badge.ageMs >= badges.outMs) {
        this.items.splice(i, 1);
        dropped = true;
      }
    }
    return dropped;
  }

  private note(key: BadgeKey, layersLeft: number, tail: boolean): void {
    const badge = this.findBadge(key);
    if (!badge) {
      this.items.push({
        key,
        layersLeft,
        tail,
        phase: 'in',
        ageMs: 0,
        counterAgeMs: Infinity,
        x: NaN,
        seen: true,
      });
      return;
    }
    badge.seen = true;
    badge.tail = tail;
    // An effect that came back while its badge was leaving brings it back in.
    if (badge.phase === 'out') this.setPhase(badge, 'in');
    if (badge.layersLeft !== layersLeft) {
      badge.layersLeft = layersLeft;
      badge.counterAgeMs = 0;
    }
  }

  private findBadge(key: BadgeKey): BadgeState | undefined {
    for (const badge of this.items) {
      if (badge.key === key) return badge;
    }
    return undefined;
  }

  private setPhase(badge: BadgeState, phase: BadgePhase): void {
    badge.phase = phase;
    badge.ageMs = 0;
  }
}

/**
 * Scale and alpha of a badge: it grows in with `inEase`, then pulses gently; with one layer
 * left it blinks; when its effect ends it shrinks to nothing. `timeMs` drives the pulse.
 */
export function badgeVisual(
  badge: Readonly<BadgeState>,
  timeMs: number,
  inEase: EaseFn,
  out: BadgeVisual,
): BadgeVisual {
  out.alpha = 1;
  if (badge.phase === 'out') {
    out.scale = Math.max(0, 1 - badge.ageMs / badges.outMs);
    return out;
  }
  const pulse = 1 + (badges.pulseScale - 1) * oscillate01(timeMs, badges.pulsePeriodMs);
  out.scale = badge.phase === 'in' ? inEase(Math.min(1, badge.ageMs / badges.inMs)) * pulse : pulse;
  if (badge.layersLeft <= 1) {
    out.alpha =
      badges.blinkMinAlpha + (1 - badges.blinkMinAlpha) * oscillate01(timeMs, badges.blinkPeriodMs);
  }
  return out;
}

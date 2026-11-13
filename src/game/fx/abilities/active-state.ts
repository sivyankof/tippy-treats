import type { ActiveEffect } from '../../../core/abilities/types';
import { CREATURE_IDS, type CreatureId } from '../../../data/creatures';
import { frameLerp } from '../../../util/math';

/** Which while-active visuals are on: one flag per creature effect, plus the brownie shield. */
export type ActiveFlags = Record<CreatureId, boolean> & { shield: boolean };

/** All flags off. */
export function emptyFlags(): ActiveFlags {
  const flags = { shield: false } as ActiveFlags;
  for (const id of CREATURE_IDS) flags[id] = false;
  return flags;
}

/**
 * Reads the sim state into `out` without allocating. Nothing is active once the run is over
 * (`running` false), so every visual stops with the run.
 */
export function readActiveFlags(
  effects: readonly ActiveEffect[],
  shield: number,
  running: boolean,
  out: ActiveFlags,
): ActiveFlags {
  for (const id of CREATURE_IDS) out[id] = false;
  out.shield = running && shield > 0;
  if (!running) return out;
  for (const effect of effects) out[effect.id] = effect.layersLeft > 0;
  return out;
}

/**
 * The ghost's guides light the flying layer when its centre is within the perfect tolerance of
 * the top layer's centre. Pure reading of the sim: the tolerance comes from the modifiers.
 */
export function guideGlow(
  guidesOn: boolean,
  flyingX: number | null,
  targetX: number,
  tolerance: number,
): boolean {
  return guidesOn && flyingX !== null && Math.abs(flyingX - targetX) <= tolerance;
}

/** States of the brownie's bubble: absent, shown, bursting (a shielded miss), melting (it ran out). */
export type BubblePhase = 'idle' | 'on' | 'popping' | 'melting';

export type BubbleInput = 'shield_up' | 'shield_down' | 'pop' | 'melt' | 'done';

/**
 * Next phase of the bubble. A shield that appears shows the bubble; a burst or a melt only
 * play on a shown bubble (a burst also cuts a melt short: the shield ran out on the very step it
 * caught a miss); a shield that just vanished without either (a new run) hides it at once;
 * `done` ends a burst or a melt.
 */
export function nextBubblePhase(phase: BubblePhase, input: BubbleInput): BubblePhase {
  switch (input) {
    case 'shield_up':
      return phase === 'idle' ? 'on' : phase;
    case 'shield_down':
      return phase === 'on' ? 'idle' : phase;
    case 'pop':
      return phase === 'on' || phase === 'melting' ? 'popping' : phase;
    case 'melt':
      return phase === 'on' ? 'melting' : phase;
    case 'done':
      return phase === 'popping' || phase === 'melting' ? 'idle' : phase;
  }
}

/**
 * What the bubble hears from the sim state each frame: a shield shows it; no shield in a running
 * game hides it at once (a new run); the end of the run melts it instead of cutting it off.
 */
export function bubbleInputFor(shield: boolean, running: boolean): BubbleInput {
  if (shield) return 'shield_up';
  return running ? 'shield_down' : 'melt';
}

const FADE_EPSILON = 0.005;

/** A fade value above this counts as visible; below it the visual is hidden. */
const FADE_VISIBLE = 0.01;

/** Whether a fade value (0 hidden, 1 shown) is far enough in to draw the visual. */
export function isFadedIn(fade: number): boolean {
  return fade > FADE_VISIBLE;
}

/** Moves a fade value (0 hidden, 1 shown) towards its target; `lerp` is the share closed per 60 Hz frame. */
export function fadeToward(value: number, on: boolean, lerp: number, dtMs: number): number {
  const target = on ? 1 : 0;
  const next = value + (target - value) * frameLerp(lerp, dtMs);
  return Math.abs(target - next) < FADE_EPSILON ? target : next;
}

import type { GoalKind } from '../../../core/run/result-goal';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import type { EffectLevel } from '../../../data/app/effect-levels';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { GOAL_LINE } from '../../../data/run/goal-line';
import { backOut, clamp01, TWO_PI } from '../../../util/math';

const flag = CONTINUE_ANIM.flag;
const { appear, pass } = GOAL_LINE;

/** Opacity and size of the line and the pennant `ageMs` after a goal appeared. */
export interface AppearView {
  lineAlpha: number;
  plateAlpha: number;
  plateScale: number;
}

/** Full: the line fades in, the pennant pops with a spring; lite: both fade in; minimal: both stand at once. */
export function appearView(ageMs: number, level: EffectLevel): AppearView {
  if (level === 'minimal') return { lineAlpha: 1, plateAlpha: 1, plateScale: 1 };
  const fade = clamp01(ageMs / appear.fadeMs);
  if (level === 'lite') return { lineAlpha: fade, plateAlpha: fade, plateScale: 1 };
  const pop = backOut(ageMs / appear.popMs, appear.spring);
  return {
    lineAlpha: fade,
    plateAlpha: fade,
    plateScale: appear.popFrom + (1 - appear.popFrom) * pop,
  };
}

/** The pennant while the goal under it is being passed. */
export interface PassView {
  /** The goal is gone: the next one may appear. */
  done: boolean;
  /** Extra scale of the flash. */
  scale: number;
  /** 0..1 share of the flash tint over the colour of the kind. */
  tintMix: number;
  /** Vertical offset of the hop (negative: up). */
  hopY: number;
  /** Opacity of the line and the pennant. */
  alpha: number;
}

/** How long a passed goal stays, ms. */
export function passDurationMs(kind: GoalKind, level: EffectLevel): number {
  if (level === 'minimal') return 0;
  return kind === 'record' ? flag.fadeMs : pass.fadeStartMs + pass.fadeMs;
}

/**
 * `ageMs` after the height passed the goal. Full and lite: flash and hop, then the fade (the
 * record has neither: its celebration covers the joy, it only fades over `flag.fadeMs`);
 * minimal: gone at once.
 */
export function passView(ageMs: number, kind: GoalKind, level: EffectLevel): PassView {
  const duration = passDurationMs(kind, level);
  if (ageMs >= duration) return { done: true, scale: 1, tintMix: 0, hopY: 0, alpha: 0 };
  if (kind === 'record') {
    return { done: false, scale: 1, tintMix: 0, hopY: 0, alpha: 1 - ageMs / duration };
  }
  const flash = ageMs < pass.flashMs ? Math.sin((ageMs / pass.flashMs) * (TWO_PI / 2)) : 0;
  const hop = ageMs < pass.hopMs ? Math.sin((ageMs / pass.hopMs) * (TWO_PI / 2)) : 0;
  const fade = clamp01((ageMs - pass.fadeStartMs) / pass.fadeMs);
  return {
    done: false,
    scale: 1 + (pass.flashScale - 1) * flash,
    tintMix: flash,
    hopY: -pass.hopHeight * hop,
    alpha: 1 - fade,
  };
}

/** The waves of a standing goal: line pulse 0..1, pennant wave and bob -1..1. All zero on minimal (nothing moves). */
export function swayView(
  timeMs: number,
  level: EffectLevel,
): { pulse: number; wave: number; bob: number } {
  if (level === 'minimal') return { pulse: 1, wave: 0, bob: 0 };
  return {
    pulse: Math.sin((timeMs / flag.pulseMs) * TWO_PI) / 2 + 0.5,
    wave: Math.sin((timeMs / flag.wavePeriodMs) * TWO_PI),
    bob: Math.sin((timeMs / flag.bobPeriodMs) * TWO_PI),
  };
}

/** Centre x of a pennant `width` wide at the screen edge `side` (1 right, -1 left). */
export function pennantX(side: 1 | -1, width: number): number {
  return side === 1
    ? LOGICAL_SIZE.width - flag.labelInset - width / 2
    : flag.labelInset + width / 2;
}

/**
 * Offset of the pennant's centre from its line at screen y `lineY`. It stands above the line; when
 * there is no room above it under the HUD (the goal is still high on the screen, or above it) the
 * pennant waits just under the HUD, so the goal is always labelled, and rides on the line again
 * once the line comes down to it. Continuous: no jump between the two places.
 */
export function pennantOffset(lineY: number, plateHeight: number): number {
  const above = -(plateHeight / 2 + flag.lineHeight);
  const lowestTop = GOAL_LINE.hud.clearY + GOAL_LINE.hud.gap;
  return Math.max(above, lowestTop + plateHeight / 2 - lineY);
}

/** The pennant hangs under the HUD, away from its line (`pennantOffset` is below the normal place above the line): it shows its pointer up. */
export function pennantWaits(lineY: number, plateHeight: number): boolean {
  return pennantOffset(lineY, plateHeight) > -(plateHeight / 2 + flag.lineHeight);
}

/** Opacity factor of the dashed line at screen y `lineY`: hidden in the HUD band, fading in under it. */
export function lineHudAlpha(lineY: number): number {
  const { clearY, lineFadeBand } = GOAL_LINE.hud;
  return clamp01((lineY - clearY) / lineFadeBand);
}

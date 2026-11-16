import { upgradePreview } from '../../../core/mastery';
import type { CreatureId } from '../../../data/creatures';
import { TRANSFORM } from '../../../data/transform-scene';
import { shakeAngle } from './new-creature-reveal';

/** What an upgrade turns the creature into: the new look (level 3) or the master (level 5). */
export type TransformKind = 'look' | 'master';

/** The scene that plays after upgrading from `fromLevel`, or `null` for an ordinary step. */
export function transformKind(id: CreatureId, fromLevel: number): TransformKind | null {
  const preview = upgradePreview(id, fromLevel);
  if (preview?.master) return 'master';
  if (preview?.newLook) return 'look';
  return null;
}

/** The look is swapped, the details pop in and the gold flash starts at these moments (ms from the start). */
export interface TransformCues {
  totalMs: number;
  /** Time the picture of the creature changes (under the cloud, or the middle of the flow on minimal). */
  swapMs: number;
  /** The creature has landed: the sparkles fly and the squeak sounds. */
  burstMs: number;
  /** Gold flash of level 5 (full and lite only). */
  flashMs: number;
}

export function transformCues(minimal: boolean): TransformCues {
  const t = TRANSFORM;
  if (minimal) {
    const swapMs = t.minimalSwapMs / 2;
    return {
      totalMs: t.minimalSwapMs + t.holdMs + t.fadeMs,
      swapMs,
      burstMs: t.minimalSwapMs,
      flashMs: t.minimalSwapMs,
    };
  }
  const burstMs = t.shakeMs + t.puffMs;
  return {
    totalMs: t.shakeMs + t.puffMs + t.popMs + t.holdMs + t.fadeMs,
    swapMs: t.shakeMs + t.puffMs / 2,
    burstMs,
    flashMs: burstMs + t.popMs,
  };
}

/** Everything the scene draws at one moment, as plain numbers. */
export interface TransformFrame {
  /** Alpha of the veil and of the whole scene, 1 until the fade. */
  fade: number;
  /** Tilt of the creature, degrees. */
  angle: number;
  /** Alpha of the new picture over the old one: 0 before the swap, 1 after. */
  mix: number;
  /** The creature is hidden under the cloud (full and lite only). */
  hidden: boolean;
  scale: number;
  /** The puff cloud: alpha and scale. */
  puff: { alpha: number; scale: number };
  /** The ribbon and the master lines. */
  labels: number;
  /** Rays alpha (0 when the kind has none) and ring progress (-1 before it starts, 0..1 while it spreads). */
  rays: number;
  ring: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const share = (t: number, from: number, ms: number): number => clamp01((t - from) / ms);

function backOut(p: number): number {
  const c = TRANSFORM.backOvershoot;
  const q = p - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
}

/** The state of the scene `ms` after its start. Pure: `skip` is just a frame at `totalMs`. */
export function transformFrame(ms: number, kind: TransformKind, minimal: boolean): TransformFrame {
  const t = TRANSFORM;
  const cues = transformCues(minimal);
  const fade = 1 - share(ms, cues.totalMs - t.fadeMs, t.fadeMs);
  const master = kind === 'master';
  const flash = master && ms >= cues.flashMs;
  const rays = flash ? t.raysAlpha * clamp01((ms - cues.flashMs) / t.holdMs) : 0;
  if (minimal) {
    return {
      fade,
      angle: 0,
      mix: share(ms, 0, t.minimalSwapMs),
      hidden: false,
      scale: 1,
      puff: { alpha: 0, scale: 1 },
      labels: share(ms, t.minimalSwapMs / 2, t.minimalSwapMs),
      rays: 0,
      ring: -1,
    };
  }
  const swapped = ms >= cues.swapMs;
  const cloud = share(ms, t.shakeMs, t.puffMs);
  const pop = share(ms, t.shakeMs + t.puffMs, t.popMs);
  return {
    fade,
    angle: shakeAngle(share(ms, 0, t.shakeMs), t.shakeWaves, t.shakeDeg),
    mix: swapped ? 1 : 0,
    hidden: ms >= t.shakeMs + t.puffMs * t.hideAtPuffShare && ms < t.shakeMs + t.puffMs,
    scale: ms < t.shakeMs + t.puffMs ? 1 : t.popFrom + (1 - t.popFrom) * backOut(pop),
    puff: {
      // Grows to full over the first part of the cloud, then thins out while the creature jumps.
      alpha: ms < cues.burstMs ? cloud : 1 - pop,
      scale: t.puffScaleFrom + t.puffScaleGrow * clamp01(share(ms, t.shakeMs, t.puffMs + t.popMs)),
    },
    labels: share(ms, t.shakeMs + t.puffMs, t.popMs),
    rays,
    ring: flash ? clamp01((ms - cues.flashMs) / t.holdMs) : -1,
  };
}

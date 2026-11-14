import { ANIM } from '../../data/anim';
import { LICK } from '../../data/lick';
import { pickRange } from '../../util/math';

/** Where a lick is in its course. */
export type LickStage = 'glance' | 'reach' | 'lap' | 'retract' | 'happy' | 'done';

/** One moment of a lick. */
export interface LickFrame {
  stage: LickStage;
  /** How far the tongue is out, 0 (in) to 1 (on the target). */
  reach: number;
  /** Progress of the lapping, 0..1: how much of the drip is gone. */
  lap: number;
  /** Sideways swing of the tongue in degrees. */
  swingDeg: number;
}

/** The lick `tMs` after it started; `glanceMs` is how long the eyes look before the tongue comes out. */
export function lickFrame(tMs: number, glanceMs: number = LICK.glanceMs): LickFrame {
  const reachAt = glanceMs;
  const lapAt = reachAt + LICK.reachMs;
  const retractAt = lapAt + LICK.lapMs;
  const happyAt = retractAt + LICK.retractMs;
  const doneAt = happyAt + LICK.happyMs;
  if (tMs < reachAt) return { stage: 'glance', reach: 0, lap: 0, swingDeg: 0 };
  if (tMs < lapAt) {
    const p = (tMs - reachAt) / LICK.reachMs;
    return { stage: 'reach', reach: 1 - (1 - p) * (1 - p), lap: 0, swingDeg: 0 };
  }
  if (tMs < retractAt) {
    const p = (tMs - lapAt) / LICK.lapMs;
    const swing = Math.sin(p * Math.PI * 2 * LICK.lapWaves) * LICK.lapWobbleDeg;
    return { stage: 'lap', reach: 1, lap: p, swingDeg: swing };
  }
  if (tMs < happyAt) {
    const p = (tMs - retractAt) / LICK.retractMs;
    return { stage: 'retract', reach: 1 - p * p, lap: 1, swingDeg: 0 };
  }
  if (tMs < doneAt) return { stage: 'happy', reach: 0, lap: 1, swingDeg: 0 };
  return { stage: 'done', reach: 0, lap: 1, swingDeg: 0 };
}

/** Total length of a lick. */
export function lickDurationMs(glanceMs: number = LICK.glanceMs): number {
  return glanceMs + LICK.reachMs + LICK.lapMs + LICK.retractMs + LICK.happyMs;
}

/** How the tongue is set: rotation (degrees), vertical scale of the stem and where the tip sits. */
export interface TongueTransform {
  angleDeg: number;
  /** Scale of the stem picture along the tongue. */
  scaleY: number;
  /** Distance from the mouth to the top of the tip picture. */
  tipDistance: number;
}

/**
 * The tongue picture hangs down from the mouth; this turns it towards (`dx`, `dy`), measured from
 * where it comes out, and stretches it to `reach` of the way. A tongue that is out is never
 * shorter than `tongueMinPx`; the round tip keeps its size and only the stem is stretched.
 */
export function tongueTransform(dx: number, dy: number, reach: number): TongueTransform {
  const length = Math.hypot(dx, dy);
  const share = Math.min(1, Math.max(0, reach));
  const shown = share <= 0 ? 0 : Math.max(LICK.tongueMinPx, length * share);
  const stem = Math.max(0, shown - LICK.tongueTipPx);
  return {
    angleDeg: (Math.atan2(-dx, dy) * 180) / Math.PI,
    scaleY: stem / LICK.tongueTextureHeight,
    tipDistance: stem,
  };
}

/** The tongue can get to a target at (`dx`, `dy`) in face pixels, not too near and not too far. */
export function inReach(dx: number, dy: number): boolean {
  const distance = Math.hypot(dx, dy - ANIM.face.mouthOffsetY);
  return distance >= LICK.reachPx[0] && distance <= LICK.reachPx[1];
}

/**
 * The tongue goes from the mouth straight to (`dx`, `dy`) and must not cross an eye on the way:
 * the target is reachable only when the line stays clear of both eyes.
 */
export function clearsEyes(dx: number, dy: number): boolean {
  const { eyeSpacing, eyeRadius, mouthOffsetY } = ANIM.face;
  const clear = eyeRadius + LICK.eyeClearPx;
  const fromY = mouthOffsetY + LICK.tongueOriginDy;
  const vx = dx;
  const vy = dy - fromY;
  const lengthSq = vx * vx + vy * vy;
  for (const eyeX of [-eyeSpacing / 2, eyeSpacing / 2]) {
    const share =
      lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (eyeX * vx + (0 - fromY) * vy) / lengthSq));
    if (Math.hypot(eyeX - share * vx, -fromY - share * vy) < clear) return false;
  }
  return true;
}

/** Counts down to the next lick: at most one for the whole tower per interval. */
export class LickScheduler {
  private waitMs: number;

  constructor(private readonly random: () => number) {
    this.waitMs = pickRange(LICK.firstDelayMs, random);
  }

  tick(dtMs: number): void {
    if (this.waitMs > 0) this.waitMs -= dtMs;
  }

  get ready(): boolean {
    return this.waitMs <= 0;
  }

  /** A lick started: the next one is a whole interval away. */
  started(): void {
    this.waitMs = pickRange(LICK.intervalMs, this.random);
  }

  /** There was nothing to lick: look again soon. */
  retry(): void {
    this.waitMs = LICK.retryMs;
  }
}

/** What decides whether a layer may lick now. */
export interface LickCheck {
  /** The layer is plain or golden: creatures keep their own faces. */
  plain: boolean;
  /** The face is shown, wide enough for a mouth and not busy. */
  faceFree: boolean;
  /** 0-based index and the index of the top layer. */
  index: number;
  topIndex: number;
  /** A layer is in the air or about to spawn. */
  aiming: boolean;
  /** Screen position of the layer centre and the visible band (world y). */
  y: number;
  bandTop: number;
  bandBottom: number;
}

/**
 * A layer is in the air or about to spawn. Read from the sim state, not from where the faces
 * look: a cloud or the spawn pause hides the layer from the faces but not from the player.
 */
export function isAiming(phase: string, hasFlying: boolean): boolean {
  return hasFlying || phase === 'flying' || phase === 'falling' || phase === 'pause';
}

/** A layer licks only when it is fully on screen; the top one keeps still while a layer is in the air or about to spawn. */
export function lickAllowed(c: LickCheck): boolean {
  if (!c.plain || !c.faceFree) return false;
  const margin = LICK.screenMarginPx;
  if (c.y < c.bandTop + margin || c.y > c.bandBottom - margin) return false;
  if (c.index === c.topIndex && c.aiming) return false;
  return true;
}

/** A drop of glaze that fell off a drip. */
export interface FallenDrop {
  x: number;
  /** Top of the drop when it started to fall. */
  y: number;
  bornMs: number;
}

/** Centre of a falling drop `ageMs` after it was born; `ease` is the curve of its fall. */
export function dropCenter(
  drop: FallenDrop,
  ageMs: number,
  ease: (t: number) => number,
  out: { x: number; y: number },
): void {
  const t = Math.min(1, Math.max(0, ageMs / ANIM.bite.dripMs));
  out.x = drop.x;
  out.y = drop.y + ANIM.bite.dripSize / 2 + ANIM.bite.dripSlide * ease(t);
}

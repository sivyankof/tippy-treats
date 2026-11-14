import { RULE_ANIM } from '../../data/rule-anim';
import { clamp01, smoothstep } from '../../util/math';

const cfg = RULE_ANIM.windup;

/** How the rush layer is drawn at one moment: pulled back by `pull` px, scaled by (scaleX, scaleY). */
export interface RushPose {
  /** Distance the layer is drawn behind its real place, against its flight direction. */
  pull: number;
  scaleX: number;
  scaleY: number;
}

/** The layer as it is: no pull, no squash. */
export function restPose(): RushPose {
  return { pull: 0, scaleX: 1, scaleY: 1 };
}

/** Ease-out of `t` (0..1) with the given power: fast at the start, flat at the end. */
export function easeOutPower(t: number, power: number): number {
  return 1 - Math.pow(1 - clamp01(t), power);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Share of the full pull-back at wind-up progress 0..1: it eases out like a slingshot being
 * drawn, but part of it is linear, so the layer is still moving when it lets go.
 */
export function pullShare(progress: number): number {
  const t = clamp01(progress);
  return lerp(easeOutPower(t, cfg.pullPower), t, cfg.creepShare);
}

/** Fills `out` with the pose of the wind-up at `progress` 0..1. */
export function windupPose(progress: number, out: RushPose): RushPose {
  const load = smoothstep(progress);
  out.pull = pullShare(progress) * cfg.pullPx;
  out.scaleX = lerp(1, cfg.load.scaleX, load);
  out.scaleY = lerp(1, cfg.load.scaleY, load);
  return out;
}

/** Time from the release until the layer is back to its own shape. */
export const RELEASE_TOTAL_MS = cfg.releaseMs + cfg.settleMs;

/**
 * Fills `out` with the pose `ageMs` after the release, starting from the pose `from` the
 * wind-up ended in: the pull returns to zero within `releaseMs` while the body snaps to a
 * stretch, which then settles over `settleMs`.
 */
export function releasePose(ageMs: number, from: Readonly<RushPose>, out: RushPose): RushPose {
  const age = Math.max(0, ageMs);
  const snap = easeOutPower(age / cfg.releaseMs, cfg.releasePower);
  out.pull = from.pull * (1 - snap);
  if (age < cfg.releaseMs) {
    out.scaleX = lerp(from.scaleX, cfg.dash.scaleX, snap);
    out.scaleY = lerp(from.scaleY, cfg.dash.scaleY, snap);
  } else {
    const settle = smoothstep((age - cfg.releaseMs) / cfg.settleMs);
    out.scaleX = lerp(cfg.dash.scaleX, 1, settle);
    out.scaleY = lerp(cfg.dash.scaleY, 1, settle);
  }
  return out;
}

/**
 * Follows a rush layer through its wind-up and the release: gives the pose to draw each
 * frame, continuing from wherever the wind-up stopped, so the picture never jumps.
 */
export class RushWindup {
  private readonly pose = restPose();
  private readonly from = restPose();
  private holding = false;
  private releaseAgeMs = Infinity;
  private justReleased = false;

  /** The wind-up ended in the step that was just taken. */
  get released(): boolean {
    return this.justReleased;
  }

  /** A new layer: forget the old one. */
  reset(): void {
    this.holding = false;
    this.releaseAgeMs = Infinity;
    this.justReleased = false;
    Object.assign(this.pose, restPose());
  }

  /** One step: `winding` and `progress` come from the rule visual. The returned pose is reused. */
  update(dtMs: number, winding: boolean, progress: number): Readonly<RushPose> {
    this.justReleased = false;
    if (winding) {
      this.holding = true;
      this.releaseAgeMs = Infinity;
      return windupPose(progress, this.pose);
    }
    if (this.holding) {
      this.holding = false;
      this.justReleased = true;
      this.releaseAgeMs = 0;
      Object.assign(this.from, this.pose);
    } else if (this.releaseAgeMs < RELEASE_TOTAL_MS) {
      this.releaseAgeMs += dtMs;
    }
    if (this.releaseAgeMs >= RELEASE_TOTAL_MS) return Object.assign(this.pose, restPose());
    return releasePose(this.releaseAgeMs, this.from, this.pose);
  }
}

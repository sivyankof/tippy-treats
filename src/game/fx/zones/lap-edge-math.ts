import { LAP_EDGE } from '../../../data/zones/lap-edge';
import { clamp01, lerp, oscillate01, smoothstep } from '../../../util/math';

/** World x of the left (-1) or right (1) edge: half the cap away from the centre of the top layer. */
export function edgeX(topX: number, halfWidth: number, side: -1 | 1): number {
  return topX + side * halfWidth;
}

/** Opacity share of the fade in, 0..1, `ageMs` after the first layer of lap 2 spawned. */
export function fadeIn(ageMs: number, fadeMs: number = LAP_EDGE.fadeInMs): number {
  return smoothstep(ageMs / fadeMs);
}

/** Opacity before the fade: twinkling on full and lite, static on minimal. */
export function edgeAlpha(timeMs: number, minimal: boolean): number {
  if (minimal) return LAP_EDGE.minimalAlpha;
  const [lo, hi] = LAP_EDGE.twinkleAlpha;
  return lerp(lo, hi, oscillate01(timeMs, LAP_EDGE.twinklePeriodMs));
}

/**
 * The half width of the edges: it shows (fades in) from the first layer of lap 2 and slides to
 * each new cap. Pure state, advanced by `step`; no Phaser.
 */
export class EdgeTween {
  /** Half width drawn now. */
  half = 0;
  /** 0..1 fade-in progress; 0 while hidden. */
  fade = 0;
  private visible = false;
  private from = 0;
  private to = 0;
  private slideAgeMs = 0;
  private fadeAgeMs = 0;

  get shown(): boolean {
    return this.visible;
  }

  /** `cap` is the layer width limit of the layer that just spawned, `lap` its lap of Space. */
  setTarget(lap: number, cap: number): void {
    if (lap < LAP_EDGE.firstLap) {
      this.hide();
      return;
    }
    const half = cap / 2;
    if (!this.visible) {
      this.visible = true;
      this.fadeAgeMs = 0;
      this.fade = 0;
      this.half = this.from = this.to = half;
      return;
    }
    if (half === this.to) return;
    this.from = this.half;
    this.to = half;
    this.slideAgeMs = 0;
  }

  hide(): void {
    this.visible = false;
    this.fade = 0;
  }

  step(dtMs: number): void {
    if (!this.visible) return;
    this.fadeAgeMs += dtMs;
    this.fade = fadeIn(this.fadeAgeMs);
    if (this.half === this.to) return;
    this.slideAgeMs += dtMs;
    const t = clamp01(this.slideAgeMs / LAP_EDGE.slideMs);
    this.half = t >= 1 ? this.to : lerp(this.from, this.to, smoothstep(t));
  }
}

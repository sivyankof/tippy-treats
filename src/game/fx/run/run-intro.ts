import { ANIM } from '../../../data/common/anim';
import type { EaseFn } from '../common/ease';

const intro = ANIM.runIntro;

/** Length of the rise along `layers` pre-built layers, in ms. */
export function introRiseMs(layers: number): number {
  return Math.min(intro.maxMs, intro.baseMs + intro.perLayerMs * Math.max(0, layers));
}

/** Share of the way covered `elapsedMs` after the intro began: 0 during the hold, then eased up to 1. */
export function introProgress(elapsedMs: number, layers: number, ease: EaseFn): number {
  const rise = introRiseMs(layers);
  const t = (elapsedMs - intro.holdMs) / rise;
  return t <= 0 ? 0 : t >= 1 ? 1 : ease(t);
}

/**
 * The start of a run above the tray: the camera first shows the built tower, then rises to the
 * working height above its top. "Fewer effects" skips it. The run waits while `active`.
 */
export class RunIntro {
  private elapsedMs = 0;
  private readonly total: number;

  /** `layers` is the number of pre-built layers; `reduced` skips the whole intro. */
  constructor(
    private readonly layers: number,
    reduced: boolean,
    /** The curve of the rise (`ANIM.runIntro.ease`). */
    private readonly ease: EaseFn,
  ) {
    this.total = layers > 0 && !reduced ? intro.holdMs + introRiseMs(layers) : 0;
  }

  get active(): boolean {
    return this.elapsedMs < this.total;
  }

  tick(dtMs: number): void {
    this.elapsedMs += Math.max(0, dtMs);
  }

  /** The camera scroll now, between the tower view (`from`) and the working view (`to`). */
  scroll(from: number, to: number): number {
    return from + (to - from) * introProgress(this.elapsedMs, this.layers, this.ease);
  }
}

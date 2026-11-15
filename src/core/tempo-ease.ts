import { BALANCE } from '../data/balance';

/** What the tempo does for one layer spawn. */
export interface TempoStep {
  /** Multiplier of the layer's nominal speed; 1 outside an ease. */
  mult: number;
  /** An ease began with this layer. */
  started: boolean;
  /** Eased layers left including this one; 0 outside an ease. */
  left: number;
}

/**
 * Streak reward: after `afterPerfects` perfect drops in a row the next `layers` layers fly
 * `speedMult` times as fast; a new ease starts at least `minGapLayers` layers after the previous
 * one started. A combo reset does not cut an ease short. A retry of the same layer (continue,
 * shield) keeps the decision it got the first time and spends nothing.
 */
export class TempoEase {
  private startedAt = -Infinity;
  private left = 0;
  private lastIndex = 0;
  private last: TempoStep = { mult: 1, started: false, left: 0 };

  /** Decision for the layer `index` (1-based) spawning with `combo` perfects in a row. */
  next(index: number, combo: number): TempoStep {
    if (index === this.lastIndex) return { ...this.last, started: false };
    const { afterPerfects, layers, speedMult, minGapLayers } = BALANCE.tempoEase;
    let started = false;
    if (this.left === 0 && combo >= afterPerfects && index - this.startedAt >= minGapLayers) {
      this.startedAt = index;
      this.left = layers;
      started = true;
    }
    this.lastIndex = index;
    if (this.left === 0) {
      this.last = { mult: 1, started, left: 0 };
    } else {
      this.last = { mult: speedMult, started, left: this.left };
      this.left -= 1;
    }
    return this.last;
  }
}

import { BALANCE } from '../../data/tower/balance';
import { speedCurve } from './speed-curve';

export type DropQuality = 'perfect' | 'normal' | 'miss';
export type CutSide = 'left' | 'right';

export interface DropInput {
  /** Centre of the falling layer. */
  flyingX: number;
  /** Width of the falling layer. */
  width: number;
  /** Centre of the tower top at the moment of landing, wobble included. */
  targetX: number;
  perfectTolerance: number;
  /** The layer is not cut (rainbow); it still counts as a normal drop outside the tolerance. */
  protectCut: boolean;
  /** Share (0..1) of the offset of a normal drop that springs back to the centre; 0 for none. */
  springShare: number;
}

export interface DropOutcome {
  quality: DropQuality;
  /**
   * Offset of the falling layer from the target; positive means to the right. For a normal drop
   * it is the offset after the spring (the raw offset times one minus the spring share).
   */
  dx: number;
  /** Width that stays on the tower; 0 on a miss. */
  newWidth: number;
  /** Centre of the remaining part relative to the target. */
  centerOffset: number;
  cutWidth: number;
  cutSide: CutSide | null;
  /** Width the cut protection saved, so the cut that would have been (0 for every other drop). */
  savedWidth: number;
}

/**
 * Nominal speed of the layer that flies above a tower of the given height: the speed curve times
 * the ability multiplier. The rush and the roof profile come on top (core/tower/flight.ts), so a layer
 * may fly faster than the curve's ceiling.
 */
export function layerSpeed(height: number, speedMult: number): number {
  return speedCurve(height) * speedMult;
}

/** Side a layer thrown with offset `dx` overhangs, so the side its cut would be on. */
export function overhangSide(dx: number): CutSide {
  return dx > 0 ? 'right' : 'left';
}

export function resolveDrop(input: DropInput): DropOutcome {
  const { width } = input;
  const dx = input.flyingX - input.targetX;
  const distance = Math.abs(dx);

  const perfect: DropOutcome = {
    quality: 'perfect',
    dx,
    newWidth: width,
    centerOffset: 0,
    cutWidth: 0,
    cutSide: null,
    savedWidth: 0,
  };
  if (distance <= input.perfectTolerance) return perfect;
  // A complete miss stays a miss even when every landed drop would be made perfect.
  if (distance >= width - BALANCE.drop.missMargin) {
    return {
      quality: 'miss',
      dx,
      newWidth: 0,
      centerOffset: 0,
      cutWidth: 0,
      cutSide: null,
      savedWidth: 0,
    };
  }
  // Perfect and miss were decided by the raw offset; the spring only softens a normal drop.
  const settled = dx * (1 - input.springShare);
  const cut = Math.abs(settled);
  if (input.protectCut) {
    // Whole layer, centred, but the throw itself counts as a normal one.
    return { ...perfect, quality: 'normal', dx: settled, savedWidth: cut };
  }
  return {
    quality: 'normal',
    dx: settled,
    newWidth: width - cut,
    centerOffset: settled / 2,
    cutWidth: cut,
    cutSide: overhangSide(dx),
    savedWidth: 0,
  };
}

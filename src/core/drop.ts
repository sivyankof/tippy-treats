import { BALANCE } from '../data/balance';

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
  autoPerfect: boolean;
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
}

/** Speed of the layer that flies above a tower of the given height. */
export function layerSpeed(height: number, speedMult: number): number {
  const { base, perLayer, max } = BALANCE.speed;
  return Math.min(max, base + perLayer * height) * speedMult;
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
  };
  if (distance <= input.perfectTolerance) return perfect;
  // A complete miss stays a miss even when every landed drop would be made perfect.
  if (distance >= width - BALANCE.drop.missMargin) {
    return { quality: 'miss', dx, newWidth: 0, centerOffset: 0, cutWidth: 0, cutSide: null };
  }
  if (input.autoPerfect) return perfect;
  // Perfect and miss were decided by the raw offset; the spring only softens a normal drop.
  const settled = dx * (1 - input.springShare);
  const cut = Math.abs(settled);
  return {
    quality: 'normal',
    dx: settled,
    newWidth: width - cut,
    centerOffset: settled / 2,
    cutWidth: cut,
    cutSide: dx > 0 ? 'right' : 'left',
  };
}

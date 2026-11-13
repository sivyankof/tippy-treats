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
}

export interface DropOutcome {
  quality: DropQuality;
  /** Offset of the falling layer from the target; positive means to the right. */
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

  if (input.autoPerfect || distance <= input.perfectTolerance) {
    return { quality: 'perfect', dx, newWidth: width, centerOffset: 0, cutWidth: 0, cutSide: null };
  }
  if (distance >= width - BALANCE.drop.missMargin) {
    return { quality: 'miss', dx, newWidth: 0, centerOffset: 0, cutWidth: 0, cutSide: null };
  }
  return {
    quality: 'normal',
    dx,
    newWidth: width - distance,
    centerOffset: dx / 2,
    cutWidth: distance,
    cutSide: dx > 0 ? 'right' : 'left',
  };
}

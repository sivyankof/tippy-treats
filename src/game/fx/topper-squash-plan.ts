import type { Rng } from '../../core/rng';
import type { EffectLevel } from '../../data/effect-levels';
import { BALANCE } from '../../data/balance';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { TOPPER_SQUASH, type SquashBurst } from '../../data/topper-squash';
import { DEG_TO_RAD, lerp } from '../../util/math';
import { glazeCrestY } from '../objects/glaze-wave';
import { layerBox } from '../objects/layer-draw';
import type { PopLaunch } from '../objects/topper-look';
import type { ParticleState } from './particle-motion';

/** What a layer that landed did to the topper of the layer below it. */
export type SquashOutcome = 'hit' | 'edge' | 'miss';

/**
 * Where the new layer (centre `layerX`, `layerWidth` wide) sits on a topper standing at `topperX`
 * with `halfBody` on each side: its whole body under the layer is a hit, its middle under the
 * layer with the body sticking out past the edge is an edge shot, otherwise the layer missed it.
 */
export function classifySquash(
  topperX: number,
  halfBody: number,
  layerX: number,
  layerWidth: number,
): SquashOutcome {
  const reach = Math.abs(topperX - layerX);
  const half = layerWidth / 2;
  if (reach + halfBody <= half - TOPPER_SQUASH.hitMarginPx) return 'hit';
  return reach < half ? 'edge' : 'miss';
}

/** What an effects level plays of the squash. */
export interface SquashLevelPlan {
  /** The squash at all (the minimal level lets the topper just disappear under the layer). */
  play: boolean;
  /** The crouch while the flying layer hovers over the topper. */
  crouch: boolean;
  /** The upper layer dips at the topper spot. */
  dip: boolean;
  /** The stain or the cream roll that stays on the layer. */
  trace: boolean;
}

/** Full plays all of it; lite keeps the squash and the trace (the particles are halved by the particle pool); minimal plays nothing. */
export function squashLevelPlan(level: EffectLevel): SquashLevelPlan {
  if (level === 'minimal') return { play: false, crouch: false, dip: false, trace: false };
  return { play: true, crouch: true, dip: level === 'full', trace: true };
}

/** The crouch (0..1) one frame later: it eases towards `target` with the time constant `easeMs`. */
export function crouchStep(current: number, target: number, dtMs: number): number {
  const k = 1 - Math.exp(-dtMs / TOPPER_SQUASH.crouch.easeMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** The scale of a topper crouched by `amount` (0..1). */
export function crouchScale(amount: number): { x: number; y: number } {
  const { scaleX, scaleY } = TOPPER_SQUASH.crouch;
  return { x: lerp(1, scaleX, amount), y: lerp(1, scaleY, amount) };
}

/** The launch of an edge shot: sideways away from the layer's middle on `side`, flatter and faster than the hop. */
export function edgeLaunch(side: -1 | 1, rng: Rng): PopLaunch {
  const { speedX, speedUp, spinDeg } = TOPPER_SQUASH.edge;
  return {
    vx: side * rng.range(speedX[0], speedX[1]),
    vy: -rng.range(speedUp[0], speedUp[1]),
    spinDeg: side * rng.range(spinDeg[0], spinDeg[1]),
  };
}

/** Where a stain sits on the front of a layer: offsets of its anchor from the layer's centre. */
export interface StainSpot {
  dx: number;
  dy: number;
  angleDeg: number;
}

/**
 * The spot of a juice stain on a layer `width` wide whose face takes `faceHalf` each side of the
 * centre: on the side the topper stood (`topperDx`, offset from the centre), clear of the face and
 * of the layer's side, under the lowest point of the glaze edge. `null` when there is no room.
 */
export function stainSpot(width: number, faceHalf: number, topperDx: number): StainSpot | null {
  const { stain } = TOPPER_SQUASH;
  const half = stain.width / 2;
  const near = faceHalf + stain.faceGapPx + half;
  const far = width / 2 - stain.edgeGapPx - half;
  if (far < near) return null;
  const side = topperDx < 0 ? -1 : 1;
  const reach = Math.min(Math.max(Math.abs(topperDx), near), far);
  const box = layerBox(width);
  const deepest = glazeCrestY(box) + PLAIN_LAYER.glaze.tongueShare * BALANCE.layer.height;
  return { dx: side * reach, dy: deepest + stain.belowGlazePx, angleDeg: side * stain.tiltDeg };
}

/**
 * Where the juice, leaves and halves are born along the seam: at the topper (`topperX`) but at the
 * side of the new layer (centre `layerX`, `layerWidth` wide), clear of its face (`faceHalf`) and
 * a little in from its edge, so they come out of the seam past the edge and never over the front.
 */
export function launchX(
  topperX: number,
  layerX: number,
  layerWidth: number,
  faceHalf: number,
): number {
  const { launch } = TOPPER_SQUASH;
  const side = topperX < layerX ? -1 : 1;
  const far = layerWidth / 2 - launch.edgeInsetPx;
  const near = Math.min(faceHalf + launch.faceGapPx, far);
  return layerX + side * Math.min(Math.max(Math.abs(topperX - layerX), near), far);
}

/** A cream roll at one end of the seam: offset of its anchor from the lower layer's centre, and which way it points. */
export interface RollSpot {
  dx: number;
  dy: number;
  side: -1 | 1;
  angleDeg: number;
}

/**
 * The two ends of the seam where the upper layer (centre `upperX`, `upperWidth` wide) sits on
 * the lower one (`lowerX`, `lowerWidth`): the cream is squeezed out there, left first. `null`
 * when the overlap is too short to have two ends.
 */
export function rollSpots(
  lowerX: number,
  lowerWidth: number,
  upperX: number,
  upperWidth: number,
): [RollSpot, RollSpot] | null {
  const { roll } = TOPPER_SQUASH;
  const left = Math.max(lowerX - lowerWidth / 2, upperX - upperWidth / 2);
  const right = Math.min(lowerX + lowerWidth / 2, upperX + upperWidth / 2);
  if (right - left < roll.minOverlapPx) return null;
  const dy = -BALANCE.layer.height / 2 + roll.seamDropPx;
  // The outer end of a roll never reaches further past the lower layer's edge than `overhangPx`.
  const outer = (1 - roll.originX) * roll.width;
  const reach = lowerWidth / 2 + roll.overhangPx - outer;
  const leftDx = Math.max(left - lowerX, -reach);
  const rightDx = Math.min(right - lowerX, reach);
  return [
    { dx: leftDx, dy, side: -1, angleDeg: -roll.droopDeg },
    { dx: rightDx, dy, side: 1, angleDeg: roll.droopDeg },
  ];
}

/**
 * The particles of a burst of `count` from (`x`, `y`) towards `side` (1 right, -1 left), lifted
 * between the burst's two angles. Every draw comes from `rng`, always the same number per particle.
 */
export function burstStates(
  burst: SquashBurst,
  count: number,
  x: number,
  y: number,
  side: -1 | 1,
  rng: Rng,
): ParticleState[] {
  const states: ParticleState[] = [];
  for (let i = 0; i < count; i++) {
    const lift = rng.range(burst.liftDeg[0], burst.liftDeg[1]);
    const heading = side === 1 ? -lift : 180 + lift;
    const speed = rng.range(burst.speed[0], burst.speed[1]);
    const spin = rng.range(burst.spin[0], burst.spin[1]);
    const swayAmplitude = burst.sway
      ? rng.range(burst.sway.amplitude[0], burst.sway.amplitude[1])
      : 0;
    const swayPeriodMs = burst.sway ? rng.range(burst.sway.periodMs[0], burst.sway.periodMs[1]) : 1;
    const swayPhase = rng.next() * Math.PI * 2;
    const scale = rng.range(burst.scale[0], burst.scale[1]);
    const lifeMs = rng.range(burst.lifeMs[0], burst.lifeMs[1]);
    states.push({
      x,
      y,
      vx: Math.cos(heading * DEG_TO_RAD) * speed,
      vy: Math.sin(heading * DEG_TO_RAD) * speed,
      gravity: burst.gravity,
      drag: burst.drag,
      // A drop tilts over as it flies, nose first.
      spin: burst.alignToFlight ? side * Math.abs(spin) : spin,
      angle: burst.alignToFlight ? heading + 90 : rng.next() * 360,
      scaleFrom: scale,
      scaleTo: burst.scaleTo,
      alpha: 1,
      holdShare: burst.holdShare,
      lifeMs,
      swayAmplitude,
      swayPeriodMs,
      swayPhase: burst.sway ? swayPhase : 0,
    });
  }
  return states;
}

/** How many particles a burst draws at full effects. */
export function burstCount(burst: SquashBurst, rng: Rng): number {
  return rng.int(burst.count[0], burst.count[1]);
}

/** Sim x of a point at world x `worldX` on a layer that sits at sim x `layer.x` and is drawn at world x `viewX` (the tower sways). */
export function simX(layer: { x: number }, worldX: number, viewX: number): number {
  return layer.x + (worldX - viewX);
}

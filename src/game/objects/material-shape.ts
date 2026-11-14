import type { CreatureMaterial, MaterialWave } from '../../data/creature-materials';
import { sineWave, TWO_PI } from '../../util/math';

/** What the shape of a material layer depends on in one frame. */
export interface ShapeInput {
  timeMs: number;
  /** Sway amplitude of the tower as a share of the largest one, 0..1. */
  swayShare: number;
  /** Phase shift of this layer (radians), so neighbouring layers do not move in step. */
  phase: number;
  /** Share of the landing shiver left: 1 right after the landing, 0 once it is over. */
  shiverLeft: number;
}

/** Scale of the layer around its bottom edge. */
export interface Shape {
  scaleX: number;
  scaleY: number;
}

/** Adds one wave of the given strength to the shape. */
function addWave(
  out: Shape,
  wave: MaterialWave,
  strength: number,
  timeMs: number,
  phase: number,
): void {
  if (strength <= 0) return;
  const s = sineWave(timeMs, wave.periodMs, phase) * strength;
  out.scaleX += wave.x * s;
  out.scaleY += (wave.mode === 'breathe' ? wave.y : -wave.y) * s;
}

/** Whether an idle burst (a shiver) is running: the first `onMs` of every `everyMs`, shifted by the phase. */
export function idleBurstOn(
  burst: { onMs: number; everyMs: number },
  timeMs: number,
  phase: number,
): boolean {
  const shifted = timeMs + (phase / TWO_PI) * burst.everyMs;
  return ((shifted % burst.everyMs) + burst.everyMs) % burst.everyMs < burst.onMs;
}

/**
 * The shape the material gives the layer this frame: the sway jiggle, the quiet idle motion and
 * the shiver after the landing, added up. Only the scale changes; the layer does not move.
 */
export function materialShape(material: CreatureMaterial, input: ShapeInput, out: Shape): Shape {
  out.scaleX = 1;
  out.scaleY = 1;
  const { timeMs, phase } = input;
  if (material.sway) addWave(out, material.sway, input.swayShare, timeMs, phase);
  const idle = material.idle;
  if (idle && (!idle.burst || idleBurstOn(idle.burst, timeMs, phase))) {
    addWave(out, idle, 1, timeMs, phase);
  }
  if (material.landShiver) addWave(out, material.landShiver, input.shiverLeft, timeMs, phase);
  return out;
}

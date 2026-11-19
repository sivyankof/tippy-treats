import { ANIM } from '../../data/common/anim';
import { faceRecipe } from '../../data/creatures/creature-looks';
import { CREATURE_SLEEP } from '../../data/creatures/creature-style';
import type { CreatureId } from '../../data/creatures/creatures';
import { faceLayout } from './face-recipe';
import type { Rect } from './layer-draw';

/** One closed eye: a lower arc centred on (x, y) from the centre of the layer, in pixels. */
export interface SleepEye {
  x: number;
  y: number;
  halfWidth: number;
  depth: number;
  thick: number;
}

/**
 * The closed eyes of a sleeping creature on a layer of this width: where the open eyes of its
 * face would be (a pair of faces for the twins), scaled like the face is.
 */
export function sleepEyes(id: CreatureId, layerWidth: number): SleepEye[] {
  const recipe = faceRecipe(id);
  const { halfWidth, depth, thick } = CREATURE_SLEEP.eyes;
  const faceScale = faceLayout(layerWidth, recipe).scale;
  const y = (ANIM.face.centerY + recipe.offsetY) * faceScale;
  const faces = recipe.pair
    ? [-recipe.pair.spread, recipe.pair.spread].map((x) => ({
        x: x * faceScale,
        scale: faceScale * recipe.pair!.scale,
      }))
    : [{ x: 0, scale: faceScale }];
  return faces.flatMap((face) =>
    [-1, 1].map((side) => ({
      x: face.x + (side * ANIM.face.eyeSpacing * face.scale) / 2,
      y,
      halfWidth: halfWidth * face.scale,
      depth: depth * face.scale,
      thick: thick * face.scale,
    })),
  );
}

/** The box around all the closed eyes, with room for their line. */
export function sleepFaceRect(id: CreatureId, layerWidth: number): Rect {
  const eyes = sleepEyes(id, layerWidth);
  const pad = CREATURE_SLEEP.eyes.clearance;
  return {
    left: Math.min(...eyes.map((e) => e.x - e.halfWidth)) - pad,
    right: Math.max(...eyes.map((e) => e.x + e.halfWidth)) + pad,
    top: Math.min(...eyes.map((e) => e.y - e.thick)) - pad,
    bottom: Math.max(...eyes.map((e) => e.y + e.depth + e.thick)) + pad,
  };
}

/** Points of the arc of a closed eye, left to right, bowing down. */
export function eyeArcPoints(eye: SleepEye, steps: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    points.push([eye.x - Math.cos(a) * eye.halfWidth, eye.y + Math.sin(a) * eye.depth]);
  }
  return points;
}

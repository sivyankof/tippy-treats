import { faceRecipe } from '../../data/creatures/creature-looks';
import { faceHalfSpan } from '../fx/glaze/glaze-growth';
import type { Span } from './tower-guest-plan';
import type { GuestContext } from './tower-guest-types';
import type { LayerPose } from './tower-view';

/** Half of the width the face of a layer takes. */
export function faceHalfOf(pose: LayerPose): number {
  const creature = pose.look.kind === 'creature' ? (pose.look.creature ?? null) : null;
  return faceHalfSpan(pose.width, creature ? faceRecipe(creature) : null);
}

/**
 * The shadow of the flying layer as offsets from the centre of `pose`, written into `box`; `null`
 * when there is none. `box` is reused: read it at once.
 */
export function shadowSpanInto(box: Span, ctx: GuestContext, pose: LayerPose): Span | null {
  const flying = ctx.state.flying;
  if (!flying || !ctx.shadow.visible) return null;
  const half = flying.width / 2;
  box.left = ctx.shadow.x - half - pose.x;
  box.right = ctx.shadow.x + half - pose.x;
  return box;
}

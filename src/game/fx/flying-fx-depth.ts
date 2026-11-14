import { DEPTH } from '../depth';

/** Draw order of what is laid around the flying layer, derived from the scene depths. */
export const FLYING_FX_DEPTH = {
  /** Speed streaks and the golden trail: behind the layer. */
  behind: DEPTH.flying - 0.5,
  /** The red outline of a rush layer, over the layer and its coats. */
  outline: DEPTH.flyingCoat + 0.5,
  /** Sparkles that circle the golden layer. */
  sparkles: DEPTH.flyingCoat + 0.6,
  /** A cloud bank: over everything that belongs to the layer, so that it hides all of it. */
  cloud: DEPTH.flyingCoat + 4,
} as const;

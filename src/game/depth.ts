/** Draw order inside the game scene, back to front. */
export const DEPTH = {
  background: 0,
  /** The worktop under the tray, its mug and steam: behind the combo halo. */
  counter: 4,
  /** Soft glow behind the tower at a high combo. */
  halo: 5,
  tray: 10,
  /** The record line of the session: behind the tower, over the tray. */
  recordFlag: 12,
  /** The translucent chocolate of the brownie's bubble: behind the tower, so it does not muddy the top layer. */
  bubbleBack: 15,
  tower: 20,
  /** Added per layer index to the tower depth: a higher layer always draws over the one below it. */
  towerLayerStep: 0.001,
  hint: 25,
  /** Dashed guides of the ghost, and the rim of the brownie's bubble, over the tower. */
  guides: 26,
  bubble: 27,
  pieces: 28,
  /** Glaze drops running down a bitten edge, above the piece they fall from. */
  drips: 29,
  /** The "Boosted!" label: it passes behind the flying layer instead of over its face. */
  boostedText: 29.5,
  flying: 30,
  /** Frost, rainbow and glow laid over the flying layer. */
  flyingCoat: 31,
  /** Dust, crumbs and sparks, over the tower and the flying layer. */
  particles: 40,
  ring: 45,
  floatText: 50,
  /** Lemon vignette and the rainbow wave: screen-wide, under the full-screen flash. */
  vignette: 85,
  wave: 90,
  /** Full-screen flash, above everything in the scene. */
  flash: 100,
} as const;

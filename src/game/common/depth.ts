/** Draw order inside the game scene, back to front. */
export const DEPTH = {
  background: 0,
  /** The worktop under the tray, its mug and steam: behind the combo halo. */
  counter: 4,
  /**
   * The goal line and its pennant (one picture of their own, one batch): over the worktop, behind the
   * halo, the tray and the tower. The halo, the tray and the tower lie on the shared atlas and draw as
   * one batch; the line sits before them, where the picture changes anyway, so it costs one draw call
   * and never splits that batch (between the tray and the tower it cost two).
   */
  goalLine: 4.5,
  /** Soft glow behind the tower at a high combo. */
  halo: 5,
  tray: 10,
  /** The translucent chocolate of the brownie's bubble: behind the tower, so it does not muddy the top layer. */
  bubbleBack: 15,
  tower: 20,
  /** Added per layer index to the tower depth: a higher layer always draws over the one below it. */
  towerLayerStep: 0.001,
  /** The small rainbow of the Rainbow layer's star: over every layer of the tower, under the aim hint. */
  rainbowJoke: 24,
  hint: 25,
  /** Dashed guides of the ghost, and the rim of the brownie's bubble, over the tower. */
  guides: 26,
  bubble: 27,
  /** Arms of a scared piece: over its body, they reach out from its sides (outline, fill, light side). */
  cutArms: 28.1,
  cutArmsFill: 28.11,
  cutArmsLight: 28.12,
  /** Crumbs of a cut that pulls strands: over the piece, under the glaze, so they never sit as squares on the strands. */
  cutCrumbs: 28.15,
  /**
   * Glaze of a cut (strands, beads, the bridge, drops): over the piece. All outlines first, then all fills,
   * then the stripes, so overlapping parts of the glaze leave no seams.
   */
  cutGlazeOutline: 28.2,
  cutGlazeFill: 28.21,
  cutGlazeGloss: 28.22,
  pieces: 28,
  /** Crumbs of a scared piece's cut: under the piece, so they never sit on its face or arms. */
  panicCrumbs: 27.96,
  /** Motion dashes behind a falling scared piece, under it. */
  cutDashes: 27.95,
  /** Stars circling over the splatted guest of the tower: behind it and in front of it. */
  guestStarsBack: 27.9,
  /** A guest pressed under a layer sits half a layer step below that layer, over the layer under it. */
  guestPressedStep: 0.5,
  guestStarsFront: 28.1,
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

/** Draw order inside the game scene, back to front. */
export const DEPTH = {
  background: 0,
  /** Soft glow behind the tower at a high combo. */
  halo: 5,
  tray: 10,
  tower: 20,
  /** Added per layer index to the tower depth: a higher layer always draws over the one below it. */
  towerLayerStep: 0.001,
  hint: 25,
  pieces: 28,
  /** Glaze drops running down a bitten edge, above the piece they fall from. */
  drips: 29,
  flying: 30,
  /** Full-screen flash, above everything in the scene. */
  flash: 100,
} as const;

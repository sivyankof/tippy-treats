/** Draw order inside the game scene, back to front. */
export const DEPTH = {
  background: 0,
  tray: 10,
  tower: 20,
  hint: 25,
  pieces: 28,
  flying: 30,
} as const;

/**
 * The transform scene (docs/06, "Превращение"): what plays in the creature window after an upgrade
 * to the level of the new look or of the master effect. All times in ms; the whole scene is
 * `shakeMs + puffMs + popMs + holdMs + fadeMs`, at most 1.6 s.
 */
export const TRANSFORM = {
  shakeMs: 300,
  /** The puff cloud covers the creature; the look is swapped at its middle. */
  puffMs: 150,
  /** The creature jumps out of the cloud: the details of the new look pop in one by one. */
  popMs: 320,
  /** The creature is happy, the ribbon and the master name stand; the gold flash of level 5 runs here. */
  holdMs: 580,
  fadeMs: 250,
  /** Minimal effects: the old look flows into the new one in this time, no shake, rays or ring. */
  minimalSwapMs: 250,
  /** The shake: how many swings and how wide (degrees); it grows towards the end. */
  shakeWaves: 7,
  shakeDeg: 7,
  /** Veil over the window under the scene. */
  veilAlpha: 0.88,
  /** Scale of the creature when it starts to pop out of the cloud. */
  popFrom: 0.5,
  /** Overshoot of the pop (the standard back curve). */
  backOvershoot: 1.70158,
  /** Puff cloud: the number and radius of the soft discs, and how far they spread. */
  puff: { discs: 7, radius: 150, spread: 130, squash: 0.6, tint: 0xffffff },
  /** Sparkles on the swap and the burst of the gold flash. */
  burst: { count: 26, hold: 8 },
  /** Gold of the flash and the rays (the gold of the mastery frame), the ring size relative to the layer. */
  gold: 0xffc93c,
  goldPale: 0xfff0a0,
  raysAlpha: 0.5,
  raysCount: 14,
  raysRadius: 1300,
  ringScale: 3.2,
  /** The ring starts at this share of its full size. */
  ringFrom: 0.3,
  /** Labels under the creature: gap below its centre, line gap, fonts. */
  labelGap: 330,
  ribbonFont: 64,
  nameFont: 56,
  phraseFont: 38,
  lineGap: 84,
  sideMargin: 80,
  /** The pop of the gold frame on the stage once the scene is gone. */
  framePop: { from: 1.08, ms: 260 },
} as const;

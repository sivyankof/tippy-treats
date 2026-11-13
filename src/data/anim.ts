/**
 * Durations, amplitudes and visual sizes from docs/06-art-animation-audio.md.
 * M2 holds what the plain run needs; M3 adds the rest of section 4.
 * Distances are logical pixels, durations milliseconds.
 */
export const ANIM = {
  layer: {
    cornerRadius: 30,
    outline: 6,
    /** Share of the layer height covered by the glaze. */
    glazeDepth: 0.36,
    dripCount: 3,
    dripLength: 22,
    glossAlpha: 0.35,
    shadowAlpha: 0.22,
    shadowHeight: 18,
    /** Darker rim at the bottom of the cake. */
    rimAlpha: 0.18,
    /** Top-to-bottom gradient: how much lighter the top is, and the number of bands. */
    gradientLift: 0.14,
    bodyBands: 6,
    glazeBands: 2,
  },
  tray: {
    thickness: 34,
    radius: 17,
    outline: 6,
    shadowHeight: 22,
    shadowAlpha: 0.35,
  },
  face: {
    /** Below this width the face scales down. */
    fullWidth: 200,
    /** Below this width only the eyes stay. */
    eyesOnlyWidth: 90,
    eyeSpacing: 70,
    eyeRadius: 20,
    pupilRadius: 10,
    pupilMaxOffset: 5,
    mouthOffsetY: 26,
    /** Vertical position of the eyes inside the layer. */
    centerY: 6,
    cheekOffsetY: 22,
    cheekSpacing: 112,
    /** Distance to the look target at which the pupils reach the full offset. */
    lookRange: 300,
    blinkMs: 120,
  },
  flying: {
    bobAmplitude: 6,
    bobPeriodMs: 800,
    /** Shadow of the flying layer on the top layer of the tower. */
    hintShadowAlpha: 0.18,
    hintHeight: 18,
  },
  sway: {
    /** Rotation of the top layer at full sway amplitude. */
    maxRotationDeg: 3,
  },
  bite: {
    spinDegPerSec: 40,
    gravity: 2400,
    lifeMs: 900,
    driftSpeed: 60,
  },
  miss: {
    spinDegPerSec: 160,
    gravity: 2400,
    lifeMs: 1400,
    driftSpeed: 120,
  },
  sneeze: {
    /** Vertical scale the top layer squashes to when the tower sneezes. */
    squashScale: 0.82,
    durationMs: 180,
  },
  ui: {
    pressScale: 0.94,
    pressMs: 80,
  },
  camera: {
    /** Share of the distance to the target covered per 60 Hz frame. */
    followLerp: 0.12,
    referenceFrameMs: 1000 / 60,
    /** Distance from the bottom of the screen to the tray surface. */
    trayBottomOffset: 300,
    /** How many layers stay visible under the flying one. */
    visibleLayers: 10,
    /** Free space kept between the HUD and the flying layer. */
    hudClearance: 32,
  },
  parallax: [0.05, 0.15, 0.3, 0.6],
  pool: {
    /** Upper cap of live tower views; layers below the screen are released earlier. */
    maxLiveLayers: 16,
    /** Layers kept alive below the bottom edge of the screen (sway, shadow). */
    offscreenMarginLayers: 1,
    /** Unused baked layer textures kept for reuse before the oldest are removed. */
    idleLayerTextures: 48,
  },
  hud: {
    numberStroke: 8,
    shadowOffset: 4,
    wobbleDangerAt: 70,
    pauseOverlayAlpha: 0.6,
    /** Steps and step length of the 3-2-1 countdown after a pause. */
    countdownSteps: 3,
    countdownStepMs: 700,
  },
  results: {
    /** Pause between the run ending and the results screen. */
    delayMs: 700,
    overlayAlpha: 0.62,
    fadeMs: 220,
  },
} as const;

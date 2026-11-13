/**
 * Durations, amplitudes and visual sizes from docs/06-art-animation-audio.md.
 * Distances are logical pixels, durations milliseconds, angles degrees.
 * `[min, max]` pairs are ranges a value is picked from at random (cosmetic only).
 * Ease names are Phaser ease strings.
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
    /** Lighter porous sponge strip on a bitten edge (section 4, "Линия среза"). */
    sponge: {
      width: 16,
      lift: 0.24,
      poreCount: 6,
      poreRadius: 3,
      poreAlpha: 0.3,
    },
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
    pupilMaxOffset: 5,
    mouthOffsetY: 26,
    /** Vertical position of the eyes inside the layer. */
    centerY: 6,
    cheekOffsetY: 22,
    cheekSpacing: 112,
    /** Brows above the eyes; inner ends go up by `raiseDeg` ("домиком"). */
    browOffsetY: -28,
    browRaiseDeg: 20,
    /** Sweat drop next to the right eye, slides down by `slide` every `periodMs`. */
    sweatX: 50,
    sweatY: -16,
    sweatSlide: 14,
    sweatPeriodMs: 900,
    /** Eyes of a horrified face grow, pupils shrink. */
    wideEyeScale: 1.2,
    widePupilScale: 0.6,
    /** Distance to the look target at which the pupils reach the full offset. */
    lookRange: 300,
    /** Share of the way to the look target the pupils cover per 60 Hz frame. */
    lookLerp: 0.2,
    blinkMs: 120,
    /** Pause between idle blinks. */
    blinkIntervalMs: [2000, 5000],
    /** Nervous eyes "float": pupils trail the sway by this share of the sway offset. */
    swayEyeLag: 0.15,
    /** The sway trail never moves a pupil farther than this, so it stays inside the eye. */
    swayEyeMax: 6,
  },
  flying: {
    /** Enters squeezed horizontally, `backOut` (section 4, "Появление"). */
    appearScaleX: 1.15,
    appearMs: 180,
    appearEase: 'Back.easeOut',
    bobAmplitude: 6,
    bobPeriodMs: 800,
    /** Shadow of the flying layer on the top layer of the tower. */
    hintShadowAlpha: 0.18,
    hintHeight: 18,
    /**
     * Excitement: aim error as a share of the layer width. Up to `grinShare` the
     * mouth is a wide `open` smile, from `edgeShare` it is `o`, between it is `smile`.
     */
    grinShare: 0.06,
    edgeShare: 0.35,
  },
  fall: {
    /** Stretch while falling; the fall itself lasts BALANCE.layer.fallMs. */
    scaleX: 0.92,
    scaleY: 1.12,
    ease: 'Quad.easeIn',
  },
  land: {
    /** Squash on impact around the bottom edge, then spring back. */
    scaleX: 1.14,
    scaleY: 0.72,
    durationMs: 320,
    ease: 'Elastic.easeOut',
  },
  wave: {
    /** Layers below the new one that squash after it. */
    layers: 8,
    delayMs: 28,
    /** Each layer squashes this share of the one above. */
    falloff: 0.7,
  },
  cameraKick: {
    /** Short push down on a normal landing. */
    drop: 6,
    durationMs: 90,
    /** A perfect landing does not shake, it bumps the view up. */
    perfectBump: 4,
  },
  dust: {
    perSide: [6, 8],
    lifeMs: 350,
  },
  sway: {
    /** Rotation of the top layer at full sway amplitude. */
    maxRotationDeg: 3,
  },
  /** Wobble levels at which faces and the gauge change. */
  wobble: {
    /** Above: eyes float, mouths `flat`. */
    nervousFrom: 40,
    /** Above: mouths `scared`, sweat; the gauge pulses and turns red. */
    dangerFrom: 70,
  },
  wobbleBar: {
    /** Spring of the fill edge: overshoot on a jump, then it settles ("волной"). */
    fillStiffness: 0.18,
    fillDamping: 0.72,
    /** A lighter band running along the fill. */
    waveWidth: 40,
    waveAlpha: 0.35,
    wavePeriodMs: 1400,
    pulseScale: 1.06,
    pulsePeriodMs: 520,
  },
  bite: {
    spinDegPerSec: 40,
    gravity: 2400,
    lifeMs: 900,
    driftSpeed: 60,
    crumbs: [10, 14],
    /** Glaze drops running down the cut edge. */
    drips: [1, 2],
    dripMs: 500,
    dripSlide: 46,
    dripSize: 14,
    dripEase: 'Quad.easeIn',
    /** "Ой": brows up, mouth `o`. */
    ouchMs: 400,
  },
  perfect: {
    ring: { fromScale: 0.6, toScale: 1.6, fromAlpha: 0.9, durationMs: 380 },
    /** White band running over the layer from left to right. */
    glossSweepMs: 260,
    glossSweepWidth: 34,
    glossSweepAlpha: 0.75,
    sparks: 12,
    text: {
      appearMs: 160,
      appearEase: 'Back.easeOut',
      rise: 80,
      fadeMs: 500,
      /** Text scale grows with the combo up to this. */
      maxScale: 1.6,
    },
    /** Every visible face is happy for this long. */
    joyMs: 300,
    /** Combo widening: the layer puffs up and its edges spring. */
    widenMs: 240,
    widenEase: 'Elastic.easeOut',
  },
  combo: {
    /** From this combo the background flashes and a halo surrounds the tower. */
    glowFrom: 8,
    flashAlpha: 0.32,
    flashMs: 260,
    haloAlpha: [0.22, 0.4],
    haloPeriodMs: 1600,
    haloFadeMs: 300,
    /** Halo size relative to the tray width and the visible tower. */
    haloWidthRatio: 1.5,
    haloColor: 0xfff3b0,
    /** Share of white mixed into the halo colour for the screen flash. */
    flashWhiteness: 0.8,
  },
  sneeze: {
    /** Vertical scale the top layer squashes to when the tower sneezes. */
    squashScale: 0.82,
    durationMs: 180,
    ease: 'Back.easeOut',
    /** The sway stands still for this long. */
    freezeMs: 150,
    /** After the freeze the sway catches up with the simulation: share of the gap closed per 60 Hz frame. */
    catchUpLerp: 0.15,
  },
  miss: {
    spinDegPerSec: 160,
    gravity: 2400,
    lifeMs: 1400,
    driftSpeed: 120,
    /** The missed layer falls past (section 4, "Замедление"; slow motion comes in M5). */
    fallMs: 400,
    /** Then every face looks after it. */
    reactMs: 300,
  },
  collapse: {
    /** Total length grows with the tower height between these heights. */
    durationMs: [1200, 1800],
    heightRange: [10, 100],
    /** Random push of each layer: sideways speed and upward hop. */
    impulseX: [-260, 260],
    hopSpeed: [380, 720],
    spinDegPerSec: [-220, 220],
    gravity: 2600,
    lifeMs: 1100,
    ease: 'Sine.easeInOut',
  },
  record: {
    durationMs: 1500,
  },
  ui: {
    pressScale: 0.92,
    pressMs: 60,
    releaseScale: 1.06,
    releaseMs: 180,
    releaseEase: 'Back.easeOut',
    /** The Play button breathes and a gloss runs over it. */
    breatheScale: 1.04,
    breathePeriodMs: 1600,
    glossEveryMs: 3000,
    transition: { outMs: 200, inMs: 280, inEase: 'Back.easeOut', cascadeMs: 40 },
    popup: { dimMs: 150, fromScale: 0.7, durationMs: 240, ease: 'Back.easeOut' },
    /** Any number change rolls over this long, longer for bigger changes. */
    numberRollMs: [400, 800],
  },
  fx: {
    /** Shared cap of live particles. */
    particleLimit: 250,
    /** "Fewer effects" turns on when the frame rate stays below this for the window. */
    lowFps: 50,
    lowFpsWindowMs: 2000,
    reducedParticleShare: 0.5,
    /** A long frame (tab in the background) is not simulated beyond this length. */
    maxSimMs: 100,
  },
  camera: {
    /** Share of the distance to the target covered per 60 Hz frame. */
    followLerp: 0.12,
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
    /** Cap of live falling pieces; when a collapse needs more, the oldest piece goes first. */
    maxLivePieces: 40,
  },
  hud: {
    numberStroke: 8,
    shadowOffset: 4,
    pauseOverlayAlpha: 0.6,
    /** Steps and step length of the 3-2-1 countdown after a pause. */
    countdownSteps: 3,
    countdownStepMs: 700,
  },
  results: {
    /** Pause between the end of the collapse and the results screen. */
    delayMs: 300,
    overlayAlpha: 0.62,
    fadeMs: 220,
  },
} as const;

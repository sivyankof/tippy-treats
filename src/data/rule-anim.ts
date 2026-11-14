import { TREASURE } from './treasure-anim';

/**
 * How the zone rules look on the flying layer (docs/02-gameplay.md, section 8): the red
 * outline and wind-up of a rush, speed streaks, the cloud that hides the layer and the
 * stars fake-out. The rules themselves live in data/zones.ts.
 * Distances are logical pixels, durations milliseconds.
 */
export const RULE_ANIM = {
  colors: {
    rush: 0xff3b30,
    rushStreak: 0xff7a68,
    /** A dark slate: it stands out from both the pale roof sky and the salmon houses. */
    windStreak: 0x3d5a80,
    /** The puff that flashes behind a rush layer when it lets go. */
    rushPuff: 0xffe9e3,
    cloud: 0xffffff,
    cloudEdge: 0xb9c9e6,
    cloudShade: 0xdbe6f6,
  },

  /** Red outline of a rush layer, pulsing from its spawn. */
  outline: {
    /** Gap between the layer body and the outline. */
    pad: 8,
    stroke: 10,
    /** Horizontal slice width of the stretchable picture; narrower outlines are widened to twice this. */
    slice: 56,
    /** The outline fades in over this time from the spawn ... */
    fadeInMs: 120,
    /** ... and then pulses slowly and softly. */
    pulsePeriodMs: 700,
    alpha: [0.6, 1],
    /** The outline breathes: its size grows by this share at the top of the pulse. */
    pulseGrow: 0.02,
    /** At the release the outline flares: it swells by this share and shines at full alpha, easing off over `flashMs`. */
    flashGrow: 0.06,
    flashMs: 200,
    /** Glow strokes baked around the stroke, wide and faint to narrow and solid. */
    glow: [
      { widthScale: 2.6, alpha: 0.18 },
      { widthScale: 1.7, alpha: 0.35 },
      { widthScale: 1, alpha: 1 },
    ],
  },

  /**
   * The held-back rush layer: it pulls back against its flight direction like a slingshot, then
   * snaps forward. Nothing trembles or freezes: the layer always moves a little.
   */
  windup: {
    /** The pull-back at the end of the wind-up. */
    pullPx: 36,
    /** The pull eases out with this power (higher is a harder start) ... */
    pullPower: 2.2,
    /** ... and keeps creeping, so that it never looks stuck before the release: this share of it is linear. */
    creepShare: 0.3,
    /** The body is squeezed along the flight and swells across it as the pull builds. */
    load: { scaleX: 0.95, scaleY: 1.05 },
    /** At the release the pull-back returns to zero within this time, with the given ease power. */
    releaseMs: 90,
    releasePower: 2,
    /** The body stretches along the flight while it snaps ... */
    dash: { scaleX: 1.08, scaleY: 0.95 },
    /** ... and settles back to its own shape over this time. */
    settleMs: 150,
    /** Face of the layer while it gathers itself. */
    face: 'scrunch',
    /** A soft puff behind the back edge at the release. */
    puff: {
      count: 5,
      /**
       * A rush layer lets go next to a wall, its back edge past the screen: the puff is kept
       * at least this far inside the screen so that it is seen.
       */
      screenInsetPx: 60,
      /** Texture scale is for the 256 px halo. */
      style: {
        speed: [60, 180],
        gravity: 0,
        drag: 4,
        spin: [0, 0],
        scale: [0.45, 0.7],
        scaleTo: 1.7,
        alpha: 0.85,
        holdShare: 0.15,
        lifeMs: [170, 260],
        spreadDeg: 70,
        tiltDeg: 0,
      },
    },
  },

  /** Streaks behind a fast layer: a rush dash at full strength, the roof wind by its speed. */
  streaks: {
    count: 6,
    /** Size of the baked streak: long, thin, solid at the head and gone at the tail. */
    width: 260,
    height: 26,
    /** One streak runs from the back edge of the layer to `travelPx` behind it this often. */
    cyclePeriodMs: 420,
    travelPx: 140,
    /** The streaks spread over this share of the layer height; above 1 the outer ones run past its top and bottom edges. */
    spreadShare: 1.3,
    rushAlpha: 1,
    windAlpha: 0.85,
    /** Length of a streak as a share of the baked picture, at the start and the end of its run. */
    lengthShare: [0.55, 1],
    /**
     * Alpha along a run: it fades in over `fadeInShare` of the run and fades out over the last
     * `fadeOutShare`, holding its peak in between. The rush streaks are a triangle; the roof wind
     * holds near its peak so that it reads on the pale sky and on the houses.
     */
    rushEnvelope: { fadeInShare: 0.25, fadeOutShare: 1 },
    windEnvelope: { fadeInShare: 0.1, fadeOutShare: 0.4 },
    /** At the release of a rush the streaks fly out longer and farther, easing back over `ms`. */
    burst: { ms: 260, lengthBoost: 0.45, travelBoost: 0.6 },
    /** The baked streak is cut into slices this wide, each with its own thickness and alpha. */
    slice: 4,
    /** Alpha along the streak grows with this power of the distance from its tail. */
    fadePower: 1.6,
  },

  /**
   * A cloud bank: puffs side by side across the whole screen hide the flying row completely.
   * It is fixed in the world while it hangs there (it does not follow the layer) and drifts on.
   */
  cloud: {
    /** Baked puff size. */
    puff: { width: 320, height: 260 },
    /** Width of the pale edge baked around a puff. */
    edge: 6,
    /** Distance between neighbouring puffs. */
    spacing: 130,
    /** The bank reaches this far past both screen edges, so that its drift never opens a gap. */
    pad: 80,
    /** Upper cap of puffs: covers the screen width plus the padding. */
    maxPuffs: 11,
    scale: [0.9, 1.15],
    bobPx: 7,
    bobPeriodMs: 1100,
    /** Phase step between neighbouring puffs, radians. */
    bobPhaseStep: 1.3,
    /** The bank sways a little while it hangs there ... */
    driftPx: 26,
    driftPeriodMs: 1700,
    /** ... and drifts on in the direction the layer flew when the cloud came. */
    driftSpeed: 60,
    /** Time to cover the layer, to leave on its own and to leave when the layer is dropped. */
    inMs: 100,
    outMs: 280,
    dropOutMs: 110,
    /** A leaving bank rises this far while it fades. */
    slidePx: 80,
    /** The puffs start this small and swell to full size while the cloud arrives. */
    enterScale: 0.9,
  },

  /** Stars fake-out: the layer freezes, looks surprised and a few stars fly off. */
  fakeout: {
    stars: 7,
    joltPx: 16,
    joltMs: 160,
    /** Surprised face; held for the stop plus the turn. */
    face: 'gape',
    faceExtraMs: 320,
    style: {
      speed: [140, 300],
      gravity: 500,
      drag: 1.2,
      spin: [-240, 240],
      scale: [0.8, 1.4],
      scaleTo: 0.3,
      alpha: 1,
      holdShare: 0.4,
      lifeMs: [420, 620],
      spreadDeg: 150,
      tiltDeg: 0,
    },
    tints: [0xffffff, TREASURE.colors.goldLight, 0x9fd8ff],
  },
} as const;

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
    /** Space rush layer that also has the roof rule: share of the strongest rush dash kept at the slow edge. */
    roofRushBase: 0.5,
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
    /**
     * The picture of the cloud and of the nebula: ONE baked figure each, on the shared atlas
     * (the atlas takes pictures up to 1024 px a side). `scale` is how much bigger than baked it is
     * shown. The layer is hidden while the cloud hangs in the world (it does not follow the layer)
     * and the layer is up to `BALANCE.layer.maxWidth` (720) wide and flies up to ~1500 px/s for up
     * to 350 ms (525 px more), so it can be anywhere on the screen: the body has to span the whole
     * logical width plus the sway and the drift, with the breathing taken off
     * (`cloud-figure.ts`, `requiredBodyWidth`; docs/08-architecture.md, section 12).
     */
    figure: {
      width: 1000,
      height: 360,
      scale: 1.4,
      /** The flat body (the part that always covers the layer row): left, right, top and bottom edges in baked px. */
      body: { left: 44, right: 956, top: 110, bottom: 250 },
      /** Thick warm outline around the figure, baked px. */
      outline: 7,
      /** Margin the layer height, bob and shake leave inside the body, display px, on each side. */
      layerMargin: 24,
    },
    /** The whole figure bobs, sways and breathes: it billows (not on the minimal level for the nebula). */
    bobPx: 7,
    bobPeriodMs: 1100,
    swayPx: 6,
    swayPeriodMs: 1900,
    breathe: 0.035,
    breathePeriodMs: 2300,
    /** The whole bank sways a little ... */
    driftPx: 26,
    driftPeriodMs: 1700,
    /** ... and drifts on, in the direction the layer flew, while it hangs and leaves. */
    driftSpeed: 60,
    /**
     * The cloud floats in ahead of time: once it is `leadMs` of flight away it comes in from
     * behind the layer, `enterPx` to the side, see-through up to `approachAlpha`, swelling from
     * `enterScale`. Its progress only moves forward and reaches 1 when the cloud arrives.
     */
    leadMs: 650,
    /**
     * Meringue "Not scary" (guides of level 5): the densest the cloud is drawn while it covers the
     * layer, so the silhouette of the layer shows through (tuned by eye). Visual only: the bot
     * has its own `DIFFICULTY.ghostCloudSdMult`.
     */
    ghostMaxDensity: 0.7,
    /**
     * The space nebula: the cloud of the Space zone is a see-through cotton-candy lump. It has the
     * same motion and the same figure size as the cloud, only another picture (`tr_nebula`) and a
     * lower density cap, with twinkling stars over it.
     */
    nebula: {
      /** Flat fills: the pink body, a lighter pink top, blue and light-pink blotches, white curls; the rim is a deeper tone of the pink. */
      colors: {
        pink: 0xff9bd2,
        pinkLight: 0xffc4e4,
        blue: 0x9cc4ff,
        blotch: 0xffe1f0,
        curl: 0xffffff,
      },
      /**
       * The densest the figure is drawn while the nebula covers the layer: one picture, so the
       * layer shows through with a contrast of about 1 - this (tuned by the contrast of the layer
       * behind the figure, docs/08-architecture.md, section 12).
       */
      maxDensity: 0.68,
      /**
       * The densest it is drawn with "Not scary", as a share of `maxDensity` (the cloud keeps
       * `ghostMaxDensity`): the layer then shows with a contrast of at least ~0.7.
       */
      ghostMaxDensity: 0.4,
      /** Twinkling stars over the figure (the shared `fx_star` picture), one pool per bank. */
      stars: {
        /** How many twinkle per bank on each effects level. */
        count: { full: 4, lite: 2, minimal: 0 },
        /**
         * Where the stars sit on the figure, from its centre: x as a share of the figure width,
         * y in px of the figure; they ride on it.
         */
        spots: [
          { x: -0.32, y: -34 },
          { x: -0.1, y: 40 },
          { x: 0.14, y: -48 },
          { x: 0.34, y: 30 },
        ],
        /** Texture scale of a star, from the smallest to the largest. */
        scale: [0.4, 0.75],
        /** Share of the base scale a star swells by at the top of its pulse. */
        pulse: 0.35,
        /** Alpha at the low and the high point of the pulse. */
        alpha: [0.25, 1],
        periodMs: 1500,
        /** Phase step between the stars, radians. */
        phaseStep: 2.1,
        tints: [0xffffff, 0xfff1a8],
      },
    },
    /** Cloud colours: dense white, a pinkish top, a lilac belly; the outline is a dark tone of the lilac. */
    colors: { white: 0xffffff, pink: 0xffd3e6, lilac: 0xcfc0f0, curl: 0xb8a6e6 },
    enterPx: 420,
    approachAlpha: 0.55,
    enterScale: 0.88,
    /** From the arrival it turns solid over this time while the sim hides the layer. */
    inMs: 110,
    /** Leaving: it speeds up along its drift, rises, grows a little and fades. */
    outMs: 560,
    /** Leaving after the layer was dropped under it. */
    dropOutMs: 300,
    /** A cloud that was floating in but never came (the layer was dropped) leaves this fast. */
    abortMs: 320,
    leaveAccel: 520,
    slidePx: 70,
    leaveGrow: 0.06,
    /**
     * The shadow of the hidden layer on the tower grows clearer with the density of the cloud:
     * from its normal strength to `shadowAlpha` at full cover, and back as the cloud leaves. It
     * also gets a light outline and a gentle pulse (both dropped in "fewer effects").
     */
    shadow: {
      /** The drawn density follows the cloud's at most this fast: 0 to 1 takes this long. */
      rampMs: 380,
      shadowAlpha: 0.85,
      outlineWidth: 3,
      outlineColor: 0xfff0a8,
      outlineAlpha: 0.95,
      /** Share of the emphasised strength the pulse takes away at its low point. */
      pulse: 0.35,
      pulsePeriodMs: 620,
    },
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

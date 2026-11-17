import type { WeatherId } from './weather';
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
    /** Roof wind streaks in weather: nearer to the sky colour and lighter, so they are not the darkest spot on the screen. */
    windStreakWeather: {
      rain: 0xc3d0e6,
      storm: 0xaebbd6,
      sunset: 0xffe6d8,
    } as Partial<Record<WeatherId, number>>,
    /** The roof wind streaks of a Space layer: light, so they read on the dark sky and stay a soft trail. */
    windStreakSpace: 0xc9dbff,
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
    height: 18,
    /** One streak runs from the back edge of the layer to `travelPx` behind it this often. */
    cyclePeriodMs: 420,
    travelPx: 140,
    /** The streaks spread over this share of the layer height; above 1 the outer ones run past its top and bottom edges. */
    spreadShare: 1.3,
    rushAlpha: 0.7,
    windAlpha: 0.85,
    /** The wind of a Space layer: fainter, a light trail on the dark sky. */
    windSpaceAlpha: 0.5,
    /** The head of the baked streak is rounded over this share of its length; the thinnest the tail gets, as a share of the height. */
    headShare: 0.12,
    tailThickness: 0.2,
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
    slice: 2,
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
      /**
       * The drawn body starts this far below `body.top`, baked px, so that the top line can stay bumpy
       * when a short screen squashes it flat: the valleys between the bumps then dip this far into the
       * body. At most the spare of the body over the cover row (70 - (60 + 7 + 24) / 1.4 = 5 px).
       */
      topDip: 5,
      /**
       * A squashed top (a short screen) is redrawn as low puffs: each dome of the drawn top line becomes a
       * flat dome as wide as the stretch of the line it made. The domes stand on a line `notchDip` px under
       * the drawn body top, so the valleys between them dip into the spare of the cover row (still well
       * above the layer at its highest bob); stretches narrower than `minSpan` baked px join a neighbour;
       * the smallest dome is `heightFloor` of the height from that line to the highest crest, the widest
       * and tallest takes all of it; a dome is never taller than `aspect` of its half width. The lighter
       * tones start `toneDip` px lower and their domes reach up to the same crests, so valleys of the base
       * tone part the low puffs and their sizes read even on the flattest top.
       */
      lowPuffs: { minSpan: 16, heightFloor: 0.4, aspect: 0.8, toneDip: 14, notchDip: 5 },
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
     * The approach never runs faster than 0 to 1 in this time, even when the look-ahead finds the cloud
     * late (a fast layer): at most about 19 CSS px of slide and 0.07 of opacity a 33 ms frame. A cloud
     * found late slides in from nearer (`enterPx` times its warning over `leadMs`), so it has less way to go.
     * When the sim starts the cover the slide runs on at this pace (no snap) while the cloud turns solid at
     * `solidPerMs` of opacity a ms (0.12 a 33 ms frame), from wherever the approach got to, or from nothing
     * when it came without a warning. The sim's cover timing does not depend on it.
     */
    approachMinMs: 400,
    solidPerMs: 0.0036,
    /**
     * The densest the dense cloud of the clouds zone is drawn at rest, 0..1: the layer under it
     * shows as a pale silhouette (contrast about 1 - this). Visual only.
     */
    maxDensity: 0.85,
    /**
     * Meringue "Not scary" (guides of level 5): the share of `maxDensity` the cloud is drawn at while it
     * covers the layer, so the silhouette of the layer shows through (tuned by eye). Visual only: the bot
     * has its own `DIFFICULTY.ghostCloudSdMult`.
     */
    ghostMaxDensity: 0.7,
    /**
     * The space nebula: the cloud of the Space zone is two glowing arms of a nebula that wind round each
     * other across the flying row (`fx/nebula-arms.ts`). It has the same motion and the same figure size
     * as the cloud and the same frame (1000 x 360 baked px, centre on the row), only other pictures: the
     * veil (`tr_nebula` frame `veil`, drawn normally) and the two arms (frames `blue` and `pink`, drawn
     * additively, so they light the veil up without hiding the layer more), with twinkling stars over it.
     */
    nebula: {
      /**
       * The veil: an even see-through haze along the row, opaque in the picture over the whole cover row
       * (the row half, `figure.layerMargin` included, in the full width of `figure.body`), so the layer is
       * muted the same everywhere (contrast 1 - `maxDensity`). Above and below the row it melts away as a
       * faint lilac glow (`fringe`) over up to `fade` px; the reach of the fringe swells and shrinks along the
       * row in long waves (`waveX` px, from `fadeMin` of `fade`), so no straight edge shows; `fadeX` px past
       * the ends of the body. `tones` drift along it in the same long waves.
       */
      veil: {
        tones: [0x5c3488, 0x6e3a8c],
        fringe: 0x9d7ad8,
        waveX: 330,
        fade: 76,
        fadeMin: 0.45,
        fadeX: 40,
      },
      /** The faint lilac glow round everything: an ellipse of half sizes `rx`, `ry`, `alpha` at the centre. */
      halo: { color: 0xa27ce0, alpha: 0.22, rx: 470, ry: 150 },
      /**
       * A short screen re-lays the drawing lower instead of squashing it: the wave is `fit` as high (0..1,
       * the most that fits the HUD gap), the curls `curlFloor + (1 - curlFloor) * fit` as big and still round,
       * the glow reaches `glowFloor + (1 - glowFloor) * fit²` as far (a thinner halo leaves the wave more
       * height), the arms' light is `lightFloor + (1 - lightFloor) * fit` (they lie over the row there); the
       * arms keep their width. Where the room over the row is less than `minFade` px, the veil is opaque
       * over the layer itself (its half height with the bobs) and melts away from there, so its edge stays soft.
       */
      layout: { curlFloor: 0.4, glowFloor: 0.45, lightFloor: 0.8, minFade: 30 },
      /** Thin pale lilac haze arcs above and below the arms: crest `y` from the centre, `sag` to the ends at `reach`. */
      arcs: { color: 0xdcccff, alpha: 0.42, width: 2.4, soft: 4, y: 126, sag: 26, reach: 330 },
      /**
       * The arms: a wave of `amplitude` px whose half period is `reach` (the arm ends there), half width
       * `width[0]` in the middle tapering to `width[1]` at the ends; the glow reaches `glow` half widths out.
       * Tones from the outside in: the glow, the dense middle, the light core and the thin thread on the axis.
       * The pink arm curls at each end into a spiral of `turns` turns, radius `radius` tightening to
       * `tighten` of it, turning `endTone` (turquoise) on the way; the blue arm, paler (`alpha`), bends into
       * small hooks the other way. Baked px from the figure centre.
       */
      arms: {
        glow: 3.4,
        step: 1.5,
        pink: {
          reach: 248,
          amplitude: 62,
          width: [27, 13],
          tones: { glow: 0xa070ff, middle: 0xff5fb4, core: 0xffb3dc, thread: 0xfff4fa },
          alpha: 0.8,
          end: {
            turns: 1.5,
            radius: 40,
            tighten: 0.28,
            endWidth: 0.45,
            tone: 0x4fe0cf,
            from: 0.86,
          },
        },
        blue: {
          reach: 296,
          amplitude: 40,
          width: [15, 8],
          tones: { glow: 0x4f6dff, middle: 0x8a9cff, core: 0xc9d3ff, thread: 0xf0f3ff },
          alpha: 0.6,
          end: { turns: 0.45, radius: 15, tighten: 0.6, endWidth: 0.6, tone: 0x8a9cff, from: 1 },
        },
        /**
         * The soft shadow the pink arm throws on the blue one behind it at the crossing: the pink arm's shape
         * `drop` px lower, from `inner` to `outer` half widths, within `reach` px of the centre; the blue arm
         * loses `alpha` of its light there and the veil under it darkens to `color` by `veilAlpha`.
         */
        shade: {
          color: 0x22103a,
          alpha: 0.85,
          veilAlpha: 0.5,
          drop: 13,
          inner: 0.9,
          outer: 3,
          reach: 90,
        },
      },
      /**
       * The core at the crossing: a warm cream glow in the veil, denser to the centre; the arms' light is
       * dimmed there by up to `cap` (no white-out, the cream, the star and the vein read); a crisp four-ray
       * star of radius `star.r` (rays `star.waist` wide at the middle) in a warm glow `star.warm` radii wide;
       * a thin dark dust vein through it (the arms are not lit along it).
       */
      core: {
        color: 0xffd89a,
        alpha: 0.95,
        radius: 80,
        cap: 0.85,
        star: { r: 26, waist: 0.16, color: 0xfff3d6, glow: 0xffb45c, warm: 1.9, warmAlpha: 0.35 },
        /**
         * The vein: a short steep stroke through the core (half length `length`, at `angle` radians from
         * the row, bent by `bend`), fading out in the row's middle band (`clear` px from the centre line,
         * where the face of the layer is) so it never lies across a face like a scratch.
         */
        vein: {
          color: 0x2a1238,
          alpha: 0.9,
          width: 2.6,
          length: 44,
          angle: -1.05,
          bend: 5,
          clear: [10, 24],
        },
      },
      /**
       * Short sprinkle strokes on the arms in the sprinkle colours of the layers: the arm, x from the
       * centre, the shift across the arm in half widths and the turn off the arm's run, radians.
       */
      sprinkles: {
        length: 13,
        width: 4.2,
        spots: [
          { arm: 'pink', u: -232, across: 0.5, turn: 0.7 },
          { arm: 'pink', u: -168, across: -0.6, turn: -0.5 },
          { arm: 'pink', u: -74, across: 0.4, turn: 0.9 },
          { arm: 'pink', u: 52, across: -0.5, turn: -0.8 },
          { arm: 'pink', u: 138, across: 0.6, turn: 0.4 },
          { arm: 'pink', u: 226, across: -0.4, turn: -0.6 },
          { arm: 'blue', u: -214, across: 0.3, turn: 0.6 },
          { arm: 'blue', u: 96, across: -0.3, turn: -0.7 },
          { arm: 'blue', u: 250, across: 0.3, turn: 0.5 },
        ],
      },
      /** Sparks baked on the arms: dots (`r` < 5) and small four-ray stars, denser near the core. */
      sparks: [
        { x: -24, y: -30, r: 7 },
        { x: 30, y: 22, r: 3 },
        { x: -52, y: 14, r: 2.5 },
        { x: 58, y: -26, r: 6 },
        { x: -120, y: -44, r: 3 },
        { x: 112, y: 40, r: 2.5 },
        { x: -230, y: -40, r: 5.5 },
        { x: 250, y: 30, r: 3 },
      ],
      /**
       * The bake: `rowsPerStep` rows of pixels per step, steps run from run load within `budgetMs` a frame,
       * long before Space (a run that starts in Space bakes at its first frame).
       */
      bake: { rowsPerStep: 4, budgetMs: 2 },
      /**
       * The motion of the arms (not on the minimal level): they flow towards each other along their wave
       * by up to `flowPx` baked px, over `flowPeriodMs`, and sway (turn by up to `swayRad` round the centre),
       * so their curls swing a little; the blue arm sways `blueSway` as much the other way.
       */
      motion: { flowPx: 9, flowPeriodMs: 5200, swayRad: 0.012, swayPeriodMs: 3700, blueSway: 0.7 },
      /**
       * The densest the figure is drawn while the nebula covers the layer: the veil is opaque in its
       * picture over the row, so the layer shows through with a contrast of about 1 - this everywhere
       * along the row (the arms are added light and do not change it; docs/08-architecture.md, section 12).
       */
      maxDensity: 0.68,
      /**
       * The densest it is drawn with "Not scary", as a share of `maxDensity` (the cloud keeps
       * `ghostMaxDensity`): the layer then shows with a contrast of at least ~0.7.
       */
      ghostMaxDensity: 0.4,
      /**
       * Stars over the figure (the shared `fx_star` picture), one pool per bank: the first one sits on
       * the core, bigger and warm, and pulses (the core pulse); the rest twinkle near the core and on the
       * arms. Lite: they stand still (the core still pulses); minimal: none (the sparks baked on the
       * arms stay).
       */
      stars: {
        /** How many are shown per bank on each effects level. */
        count: { full: 5, lite: 5, minimal: 0 },
        /** Whether the stars (but the core one) twinkle on each level. */
        twinkle: { full: true, lite: false, minimal: false },
        /**
         * Where the stars sit on the figure, from its centre: x as a share of the figure width,
         * y in px of the figure; they ride on it.
         */
        spots: [
          { x: 0, y: 0 },
          { x: -0.06, y: 26 },
          { x: 0.07, y: -34 },
          { x: -0.19, y: -52 },
          { x: 0.2, y: 50 },
        ],
        /** Texture scale of a star, from the smallest to the largest. */
        scale: [0.4, 0.75],
        /** The core star: its scale, warm tint and pulse period. */
        core: { scale: 0.9, tint: 0xfff0c8, periodMs: 1900 },
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

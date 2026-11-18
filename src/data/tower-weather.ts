import type { EffectLevel } from './effect-levels';

type PerLevel<T> = Record<EffectLevel, T>;

/**
 * The living weather on the tower (docs/06, "Живая погода на башне"): snow drifts on the ledges, the
 * dust of a landing on a snow cap, the startle at a flash of lightning and the sleepy layers of the
 * night. Looks only; nothing here reaches the sim, the score or the save. Lengths are in logical px.
 */
export const TOWER_WEATHER = {
  /** Snow drifts on the ledges of the layers (Roof and Clouds in snow). */
  drift: {
    /** A ledge narrower than this carries no drift. */
    minLedgePx: 24,
    /** The drift stops this far short of the corner of the layer and of the seam under the layer above. */
    insetPx: 4,
    /** Thickness of a drift per px of its width, before the clamps. */
    thicknessPerPx: 0.14,
    minThicknessPx: 6,
    /** The drift is never thicker than this share of the snow cap on the top layer. */
    maxShareOfCap: 0.55,
    /** A drift buried under a wider layer above squashes away over this long. */
    squashMs: 200,
    /** The widths the drift picture is baked at (px); a drift takes the nearest one and stretches a little. */
    pictureWidths: [32, 64, 128, 256, 400],
    /** Clear picture rows under the baseline of the heap (outline room) and above its peak. */
    padPx: 3,
    /** Rows of the picture under the top edge of the layer: the drift sits this deep in the rim. */
    sinkPx: 1,
    outlinePx: 1.6,
    /** Depth of the baked heap swell (share of its height). */
    swell: 0.12,
  },
  /** The flakes thrown up when a layer lands on a snow cap. */
  dust: {
    count: { full: 7, lite: 3, minimal: 0 } as PerLevel<number>,
    /** Seen from the seam: how far out and up the arc starts, px per second. */
    speedPx: [150, 260] as readonly [number, number],
    /** Launch angle above the horizontal, degrees. */
    angleDeg: [18, 62] as readonly [number, number],
    /** Share of the speed the air takes away each second. */
    drag: 2.4,
    /** Gravity once the flake slows down, px per second squared. */
    gravityPx: 330,
    lifeMs: [600, 900] as readonly [number, number],
    /** The flake grows from nothing over this long. */
    growMs: 80,
    /** Flake scale against its picture (they are the weather flakes, smaller). */
    scale: [0.7, 1] as readonly [number, number],
    spinDeg: 220,
    /** The flake picture (index into the weather flakes). */
    pictures: [0, 1, 2],
    /** The dust waits for the cap to have grown this much (share of `cap.growMs`). */
    minCapShare: 0.25,
  },
  /** The scared face when a bolt flashes. */
  startle: {
    holdMs: 400,
    /** Each layer down the tower reacts this much later than the one above; the wave ends at `maxDelayMs`. */
    stepMs: 20,
    maxDelayMs: 60,
    /** Back to the calm face over this long (the eyes shrink from wide to normal). */
    returnMs: 120,
    hop: { px: 6, ms: 260 },
    /** Only this many layers from the top startle on the lite level. */
    liteLayers: 3,
  },
  /** The sleepy layers of the night. */
  sleepy: {
    /** One yawn on the tower every so long, ms. */
    yawnEveryMs: [6000, 10000] as readonly [number, number],
    /** Blinking of a sleepy face: rarer and slower than usual. */
    blinkIntervalMs: [4500, 8000] as readonly [number, number],
    blinkMs: 260,
    /** The yawn: the face draws itself up (anticipation), the mouth gapes, then it closes with a smack and a spring. */
    yawn: {
      prepMs: 200,
      gapeMs: 700,
      closeMs: 250,
      /** Face stretch (scale of the face up, the share of its height) during the prep and the gape. */
      stretchPrep: 0.06,
      stretchGape: 0.1,
      /** The mouth is this big against the lick gape picture. */
      mouthScale: 0.8,
      /** The face lifts this far while it draws itself up (face px). */
      liftPx: 3,
      /** The overshoot of the close: the face squashes this much at its lowest. */
      squashClose: 0.07,
    },
  },
} as const;

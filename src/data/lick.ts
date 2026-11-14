import type { CreatureId } from './creatures';

/** How a layer licks (see `LICK.styles`). */
export interface LickStyle {
  /** Stretches every beat (above 1 is slower). */
  tempo: number;
  /** How far round the face the tip goes: 1 is the whole loop, below 1 out and back on one side (one motion). */
  sweep: number;
  /** Share of the full peak length the tongue stretches to. */
  peak: number;
  /** The second short stroke along the lips. */
  lips: boolean;
  /** A cheeky wink instead of the happy squint. */
  wink: boolean;
}

/**
 * The lick (docs/06, section 3, "Слизывание глазури"): the main joke of the tower at rest, in the
 * manner of the rubber-hose animation of old cartoons (only the motion techniques: wind-up,
 * smear, overshoot, skid, spring). A drop of glaze comes to a face and the layer licks it off,
 * in a big scene or a short one. Distances are pixels in the coordinates of the face (scale 1,
 * y down from the line of the eyes), times are milliseconds.
 */
export const LICK = {
  /** At most one lick for the whole tower per this time, counted from the start of the last one. */
  intervalMs: [6000, 10000] as readonly [number, number],
  /** The first lick of a run (always the big scene) comes this soon, within the first half minute. */
  firstDelayMs: [7000, 11000] as readonly [number, number],
  /** After the first, a lick is the big scene with this chance, otherwise the short one. */
  bigChance: 0.2,
  /** When no layer can lick right now the next look comes after this time. */
  retryMs: 1000,
  /** A layer is on screen for a lick when it is at least this far from the screen edge. */
  screenMarginPx: 40,
  /** A face scaled below this (a narrow layer) does not lick. */
  minFaceScale: 0.8,
  /** Share of the plain layers' licks where the drop runs down beside the eye; the rest fall onto the cheek. */
  runShare: 0.5,
  /** Chance that each neighbour (the layer above, the layer below) glances at the lucky one. */
  neighbourGlanceChance: 0.6,
  /** Chance that one glancing neighbour licks its lips enviously when the lucky one is happy. */
  envyChance: 0.5,
  /** The drop starts this far inside the glaze edge, so it comes out of the glaze. */
  glazeInsetPx: 3,

  /** The big scene, beat by beat, at tempo 1 (1.75 s). */
  big: {
    arrive: 200,
    notice: 140,
    windup: 180,
    shoot: 100,
    loop: 460,
    stretch: 110,
    hold: 180,
    curl: 80,
    snap: 60,
    lips: 130,
    happy: 110,
  },
  /** The short scene for repeats, at tempo 1 (0.7 s). */
  short: {
    arrive: 200,
    sly: 150,
    out: 100,
    stroke: 170,
    back: 80,
  },

  /**
   * The path of the tongue tip in the big scene: a loop through the mouth across the face, `rx` x
   * `ry` around (0, `centerY`), its bottom at the root of the tongue in the gaping mouth and its
   * top just above the line of the eyes, so the tongue passes over the eyes, not above the brows. The tip shoots out to `shootTo` of the
   * loop, goes round to `loopTo` speeding up (progress to the power `accel`) and skids outwards on
   * the side turns by up to `skid`. `rx` shrinks on a narrow layer, so the tongue stays within
   * about half the layer width, but not below `minRxShare`. The tongue lies along the way the tip
   * came until the tip is `wrapUntil` round, then over `sweepOver` it swings across the face in a
   * bow that bulges out by `bulge`.
   */
  loop: {
    rx: 120,
    ry: 22,
    centerY: 16,
    shootTo: 0.1,
    loopTo: 0.9,
    shootOvershoot: 2.6,
    accel: 1.5,
    skid: 0.12,
    minRxShare: 0.6,
    wrapUntil: 0.4,
    sweepOver: 0.45,
    bulge: 0.5,
  },
  /** After the loop the tongue stretches sideways out of the cheek to its peak: `px` from the mouth (at most half the layer width), `y` below the eyes. */
  peak: { px: 190, y: 26, overshoot: 1.6 },

  /** The tongue drawn over the face (and over the eyes): a flat wide ribbon, a chain of baked pieces. */
  tongue: {
    segments: 20,
    /**
     * Width of the ribbon (without its outline) per scene: `root` where it leaves the mouth, `full`
     * in the middle and at the tip, reached at `fullAt` of the length. The big scene's is much wider.
     */
    width: { big: { root: 32, full: 70 }, short: { root: 16, full: 34 } },
    fullAt: 0.35,
    outline: 3,
    /** The tip is a wide round spatula: half an ellipse this tall, as a share of the width. */
    tipShare: 0.42,
    /** The light stripe and the dark groove along the middle: offsets and widths as shares of the width. */
    stripeAt: -0.24,
    stripeWidth: 0.13,
    grooveWidth: 0.07,
    fill: 0xff7c93,
    groove: 0xc8435f,
    stripeAlpha: 0.55,
    /** The tip curls by this much over this share of the tongue. */
    curlDeg: 220,
    curlShare: 0.4,
    /** A wave runs along it from root to tip: amplitude at the tip, wavelength as a share of the tongue, waves per second. */
    wave: { amp: 5, length: 0.6, hz: 3 },
    /** At the peak it trembles: amplitude at the tip and frequency. */
    tremble: { amp: 2.5, hz: 28 },
    /** The smear of the shot: the tongue starts this narrow and widens over this share of the shot. */
    smear: { width: 0.55, share: 0.5 },
  },
  /** A drop of saliva hangs from the tip at the peak and swells. */
  saliva: { size: 20, color: 0xeaf7ff, alpha: 0.9, hangPx: 8 },
  /**
   * The ordinary growing drips the tongue passes over (of the licking layer and of the layer above
   * running onto it): touched, a drip shrinks to `shortenTo` of its length in `shrinkMs` with a
   * little spring (`overshoot`), then slowly regrows in `regrowMs`. It counts as touched when it
   * comes within `touchPx` of the edge of the tongue.
   */
  drip: { shortenTo: 0.25, shrinkMs: 140, overshoot: 2, regrowMs: 6000, touchPx: 6 },
  /** The wet trail the tip leaves: glossy blobs along its way that dry fast. */
  trail: { count: 26, alpha: 0.45, dryMs: 520, size: 30 },

  /** The drop of the big scene, as a point of the loop (on the side the tongue goes first). */
  drop: {
    /** It runs down from the glaze beside the eye. */
    runAt: 0.17,
    /** It falls onto the cheek. */
    fallAt: 0.11,
    /** The landed drop squashes and springs back. */
    landSquash: 0.6,
    squashMs: 140,
    /** The falling drop is drawn this much bigger than the thin running drip. */
    dropScale: 1.8,
    /** Once the tip reaches it the drop is gone in about this time. */
    eatMs: 90,
  },
  /**
   * The short scene: the drop lands on the cheek; the tip goes out of the corner of the small mouth
   * (`mouthX`, `mouthY`) below and outside it, then one stroke up through it. The tongue keeps off
   * the eyes: it may overlap an eye circle by at most `eyeClearPx`.
   */
  shortPath: {
    dropX: 84,
    dropY: 26,
    mouthX: 12,
    mouthY: 34,
    out: { dx: 12, dy: 20 },
    stroke: { dx: 4, dy: -24 },
    eyeClearPx: 4,
    /** The tip's stroke bows outwards by this much. */
    bow: 14,
    /** The tongue bends at this low knee (x on the drop's side), below the eye, once it is all out. */
    knee: { x: 70, y: 56 },
    outOvershoot: 2,
    /** Share of the stroke at which the drop is taken. */
    takeAt: 0.4,
  },

  /** The face. */
  face: {
    /** The wind-up squeezes the face to this scale; the mouth purses to `purse` of the "oh". */
    windup: { scaleX: 1.12, scaleY: 0.82, purse: 0.5 },
    /**
     * The mouth of the big scene gapes to half the face (`face_mouth_gape`), down from its upper lip
     * at `lipY`; its width grows from `widthFrom` with the opening, between `minWidth` and `maxWidth`,
     * the height springs past by `overshoot`. The eyes and brows go up by `eyesUpPx` to make room.
     */
    gape: { lipY: 8, widthFrom: 0.6, minWidth: 0.3, maxWidth: 1.15, overshoot: 2.2, eyesUpPx: 10 },
    /**
     * An eye the tongue lies over shuts as an arc: when the ribbon comes nearer to its centre than
     * `coverShare` of the eye radius; it opens again `openDelayMs` after the tongue has gone.
     */
    eyeCover: { coverShare: 0.5, openDelayMs: 90 },
    /** The face dents and stretches after the tongue tip, lagging behind. */
    dent: { px: 6, stretch: 0.08, lerp: 0.3 },
    /** After the snap the face springs: scale swings by `amp`, every `periodMs`, dying out in `decayMs`. */
    spring: { amp: 0.06, periodMs: 120, decayMs: 110, ms: 300 },
    /** The cheeks puff for an instant when the tongue snaps in. */
    puff: { scale: 1.5, ms: 160 },
    /** Raised brows. */
    brows: { liftPx: -9, angleDeg: 8 },
    /** The small "oh" of noticing. */
    ohScale: 0.85,
    /** The small open mouth of the short scene and of licking the lips: open by this much, down from `wideLipY`. */
    wideScale: 0.8,
    wideLipY: 18,
  },
  /** Licking the lips with a short tongue: the tip slides from one corner to the other, tilting over. */
  lips: {
    fromX: -9,
    toX: 9,
    y: 30,
    angleDeg: 75,
    length: 12,
    widthScale: 0.7,
    /** Heights of the short tongue pictures: the round tip (`face_tongue_tip`) and the stem (`face_tongue`). */
    tipPx: 13,
    stemTexturePx: 40,
    /** A neighbour's envious lick of its lips. */
    envyMs: 380,
  },
  /** Happy end: the cheeks blush and swell, a heart floats up from above the head; the squint stays a little longer. */
  happy: { blushScale: 1.35, heartY: -48, lingerMs: 500 },
  /** The heart: picture size, outline, and how it floats (the shape of a particle style). */
  heart: {
    size: 34,
    outline: 3.5,
    style: {
      speed: [90, 120],
      gravity: -60,
      drag: 1.2,
      spin: [-40, 40],
      scale: [0.9, 1.05],
      scaleTo: 1.25,
      alpha: 1,
      holdShare: 0.55,
      lifeMs: [900, 1100],
      spreadDeg: 30,
      tiltDeg: 0,
    },
  },

  /** How each creature licks. Twins (two faces) do not lick. */
  styles: {
    plain: { tempo: 1, sweep: 1, peak: 1, lips: true, wink: false },
    /** Lazy and slow. */
    honey: { tempo: 1.14, sweep: 1, peak: 1, lips: true, wink: false },
    /** Fast and cheeky. */
    lemon: { tempo: 0.86, sweep: 1, peak: 1, lips: true, wink: true },
    /** Restrained: one motion out and back. */
    brownie: { tempo: 0.9, sweep: 0.42, peak: 0.6, lips: false, wink: false },
  } satisfies Record<string, LickStyle>,
  /** Creatures licking in a style of their own; every other creature licks like a plain layer. */
  creatureStyles: { honey: 'honey', lemon: 'lemon', brownie: 'brownie' } as Partial<
    Record<CreatureId, 'honey' | 'lemon' | 'brownie'>
  >,
} as const;

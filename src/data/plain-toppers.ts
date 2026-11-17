/**
 * Big toppers of the plain layers (docs/06, section 3, "Простые слои", "Украшение на макушке"):
 * one large sweet that sits on the top edge beside the face of about one plain layer in four and
 * hops off when the next layer lands. Sizes are in screen pixels of the shown picture; the
 * baked texture of a kind is `bakeScale` times bigger so it stays crisp.
 */

export type TopperKind = 'cherry' | 'lemon' | 'strawberry' | 'mint' | 'wafer';

/** Every kind; the order is part of the seeded choice. */
export const TOPPER_KINDS: readonly TopperKind[] = [
  'cherry',
  'lemon',
  'strawberry',
  'mint',
  'wafer',
];

/** Room added around the drawing of a kind, in drawn pixels: the outline and tips fit with a few pixels to spare. */
export interface TopperField {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TopperKindLook {
  /** Size of the picture as drawn (shown `showScale` times bigger). */
  width: number;
  height: number;
  /** y (in shown pixels from the picture top) of the spot that rests on the layer. */
  restY: number;
  /** Half of the width the topper takes on the edge (drawn size; for the place beside the face and the fly). */
  halfBody: number;
  /** The picture is this much bigger than `width` x `height` on each side; the anchor (middle of `width`, `restY`) stays on the same spot of the drawing. */
  field: TopperField;
  /** Tilt it rests at, degrees (positive leans to the right; mirrored with the side). */
  restDeg: number;
}

export const PLAIN_TOPPERS = {
  /** Name of the stream forked from the cosmetic seed, followed by `:<layer number>`. */
  stream: 'topper',
  /** Name of the stream of the launch of a hopped-off topper, followed by `:<layer number>`. */
  popStream: 'topper-pop',
  /** Share of the layers without a small decoration that get a topper (about 1 in 4 of all plain layers). */
  shareOfBare: 1 / 2,
  /** If none of layers 1..`guaranteeTo` got a topper, the first bare layer from `guaranteeFrom` gets one. */
  guaranteeFrom: 4,
  guaranteeTo: 10,
  /** The pictures are drawn at the sizes of `kinds` and shown this many times bigger. */
  showScale: 1.35,
  /** The baked texture is this many times bigger than the shown picture. */
  bakeScale: 2,
  /** Outline thickness, shown pixels. */
  outlinePx: 3,
  /** How far the resting spot sinks below the top edge of the layer. */
  sinkPx: 6,
  /** Gaps beside the face and at the edge of the layer, and where in the free stretch it sits (0 near the face, 1 far). */
  faceGapPx: 14,
  edgeGapPx: 10,
  reach: 0.45,
  kinds: {
    cherry: {
      width: 66,
      height: 92,
      restY: 86,
      halfBody: 24,
      restDeg: 0,
      field: { left: 4, right: 13, top: 6, bottom: 4 },
    },
    lemon: {
      width: 84,
      height: 48,
      restY: 44,
      halfBody: 38,
      restDeg: 0,
      field: { left: 3, right: 3, top: 3, bottom: 3 },
    },
    strawberry: {
      width: 70,
      height: 70,
      restY: 64,
      halfBody: 26,
      restDeg: 14,
      field: { left: 0, right: 0, top: 0, bottom: 0 },
    },
    mint: {
      width: 74,
      height: 62,
      restY: 58,
      halfBody: 30,
      restDeg: 0,
      field: { left: 3, right: 3, top: 3, bottom: 3 },
    },
    wafer: {
      width: 62,
      height: 84,
      restY: 78,
      halfBody: 24,
      restDeg: 0,
      field: { left: 3, right: 3, top: 3, bottom: 5 },
    },
  } satisfies Record<TopperKind, TopperKindLook>,
  colors: {
    cherry: {
      base: 0xd8203c,
      shadow: 0xa8132c,
      gloss: 0xffffff,
      stem: 0x6e8a2c,
      leaf: 0x3fbf6e,
      leafLight: 0x8ff0b0,
    },
    lemon: {
      rind: 0xf4e04a,
      rindShadow: 0xd9c02e,
      pulp: 0xfff8bd,
      segment: 0xe3c63a,
      gloss: 0xffffff,
    },
    mint: { base: 0x3fcf7a, shadow: 0x27a05a, vein: 0x9bf5bd, gloss: 0xffffff },
    wafer: {
      base: 0xe9b87a,
      shadow: 0xc98d4c,
      lattice: 0xb06f34,
      inside: 0x7a4a26,
      gloss: 0xfff4d8,
    },
  },
  /** Highlight of the hand-drawn kinds as shares of the shown size (the strawberry has its own). */
  gloss: { length: 0.14, thick: 0.045, tiltDeg: -55, dotGap: 0.05, dotRadius: 0.02, alpha: 0.9 },
  /** The spring hop when the next layer lands, and the flight off the tower. */
  hop: {
    /** Squash of the first instant, springing back over `springMs`. */
    squashX: 1.3,
    squashY: 0.7,
    springMs: 110,
    /** Launch speeds, pixels per second (up is the negative y), and the spin, degrees per second. */
    speedX: [380, 560],
    speedUp: [520, 700],
    spinDeg: [420, 760],
    gravity: 2600,
    lifeMs: 1300,
    /** The fade starts at this share of the life. */
    fadeFrom: 0.75,
    /** Quieter than a normal drop. */
    soundGain: 0.6,
  },
  /** How many hopped-off toppers fly at once (the oldest is reused). */
  maxFlying: 4,
} as const;

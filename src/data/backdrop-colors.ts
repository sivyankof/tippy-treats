import { KITCHEN_COLORS } from './palette';
import type { ZoneId } from './zones';

/** One colour of a vertical gradient; `at` runs from 0 (top of the screen) to 1 (bottom). */
export interface GradientStop {
  at: number;
  color: number;
}

/** Sky of every zone, top to bottom: warm kitchen, day, sunset, night, space (docs/06, section 5). */
export const ZONE_SKY: Record<ZoneId, readonly GradientStop[]> = {
  kitchen: [
    { at: 0, color: KITCHEN_COLORS.skyTop },
    { at: 1, color: KITCHEN_COLORS.skyBottom },
  ],
  showcase: [
    { at: 0, color: 0x8fd0ff },
    { at: 1, color: 0xe4f6ff },
  ],
  roof: [
    { at: 0, color: 0x74bff2 },
    { at: 0.7, color: 0xbfe3f7 },
    { at: 1, color: 0xffe2bd },
  ],
  clouds: [
    { at: 0, color: 0x6f5aa8 },
    { at: 0.5, color: 0xff7f86 },
    { at: 1, color: 0xffc58a },
  ],
  stars: [
    { at: 0, color: 0x070b33 },
    { at: 1, color: 0x2c2f78 },
  ],
  space: [
    { at: 0, color: 0x04020e },
    { at: 0.6, color: 0x120a2e },
    { at: 1, color: 0x2a1250 },
  ],
};

/** Colours of the pictures baked for each zone's backdrop and background life. */
export const BACKDROP_COLORS = {
  shared: {
    white: 0xffffff,
    warmWhite: 0xfff6ec,
    ink: 0x3b2a4a,
  },
  kitchen: {
    pot: 0xaab4c6,
    potDark: 0x7f8aa0,
    ladle: 0xcfd6e2,
    ladleDark: 0x8f98aa,
    rail: 0x8a5a3c,
    clockCase: 0xa8693f,
    clockRim: 0x7b4a2d,
    clockFace: 0xfff3df,
    pendulum: 0xffc93c,
    fly: 0x3b2a4a,
    mug: 0xff5c8a,
    coffee: 0x6b4332,
    sheen: 0xffffff,
  },
  showcase: {
    building: 0xb4daf3,
    buildingWindow: 0xe9f7ff,
    frame: 0xffffff,
    glass: 0xd6f0ff,
    glint: 0xffffff,
    awningA: 0xff5c8a,
    awningB: 0xfff6ec,
    shelf: 0xc98d62,
    treat: [0xffb3c7, 0xb9e4ff, 0xcdb8ff, 0xffe08a],
    bulbs: [0xff5c8a, 0xffc93c, 0x3ddc97, 0x7c5cff],
    wire: 0x6b5a7a,
    walker: 0x3b2a4a,
    standBase: 0xe9d5c3,
    cake: 0xf4c58f,
    glaze: 0xffb3c7,
    cherry: 0xe8334a,
    sprinkles: [0xffc93c, 0x3ddc97, 0x7c5cff, 0xffffff, 0xff5c8a],
  },
  roof: {
    far: 0xb9b0e0,
    mid: 0xe09a85,
    midDark: 0xc4705f,
    near: 0xb5654f,
    nearDark: 0x8c4a3b,
    brick: 0xb5654f,
    brickDark: 0x8c4a3b,
    chimneyCap: 0x7a4a3c,
    smoke: 0xece4f0,
    bird: 0x3b2a4a,
    rope: 0x6b5a7a,
    pole: 0x8a5a3c,
    laundry: [0xff5c8a, 0xfff6ec, 0x7c5cff, 0xffc93c],
  },
  clouds: {
    far: 0xe3b4d6,
    mid: 0xffd0c2,
    near: 0xfff0e2,
    haze: 0xffe9c4,
    balloonA: 0xff5c8a,
    balloonB: 0xffc93c,
    basket: 0xb57a52,
    rope: 0x6b5a7a,
    planeBody: 0xfff6ec,
    planeWing: 0xff5c8a,
    planeWindow: 0x7c5cff,
  },
  stars: {
    star: 0xffffff,
    warm: 0xfff3b0,
    glow: 0x7c5cff,
    moon: 0xfff1b8,
    moonCrater: 0xe7d68e,
    moonFace: 0x3b2a4a,
    moonCheek: 0xff9bb3,
    shooting: 0xffffff,
  },
  space: {
    star: 0xffffff,
    dust: 0xc9b8ff,
    nebulaA: 0xff5cb8,
    nebulaB: 0x5cc8ff,
    nebulaC: 0x7c5cff,
    planetA: 0xff9a5c,
    planetABand: 0xffc08a,
    ring: 0xffe3a8,
    planetB: 0x5cc8c0,
    planetBBand: 0x3b9a96,
    rock: 0x7a6a99,
    satellite: 0xd8dde6,
    panel: 0x5c7cff,
    light: 0xff4c4c,
    cometHead: 0xffffff,
    cometTail: 0x9ad8ff,
  },
} as const;

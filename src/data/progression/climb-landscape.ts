import { KITCHEN_COLORS } from '../common/palette';
import { BACKDROP_COLORS } from '../backdrop/backdrop-colors';
import { MOUNTAIN_LOOK } from '../backdrop/backdrop-mountains';

/** What one picture of the ribbon stands for: a zone of Classic or a lap of Space. */
export type LandscapeKind = 'kitchen' | 'showcase' | 'roof' | 'clouds' | 'stars' | 'lap';

/** A colour stop of the sky along the ribbon; `p` is in bands from the bottom of the ribbon (0 = foot of the kitchen). */
export interface SkyStop {
  p: number;
  color: number;
}

/** The kind of the little sign that carries the name of a zone. */
export type SignKind = 'wood' | 'cloud' | 'star';

const C = BACKDROP_COLORS;

/**
 * The pictures of the climb map ribbon (docs/06, section 5 and the climb map paragraph; docs/07,
 * section 2.3): one landscape cut into one picture per band, so the sky runs on from picture to
 * picture without a seam. Pixels of the picture; x runs from the left of the ribbon, y from the
 * top of the band.
 */
export const CLIMB_LANDSCAPE = {
  /** Thickness of the warm outline of every body. */
  outline: 4.5,
  /** Share of a body kept as the flat shadow band at its bottom right (`drawTwoToneBody.band`). */
  band: 0.1,
  shadowShade: -0.18,
  /** The sky along the ribbon: peach at the foot of the house, day, dusk, night. Above the Stars it is the Space lap gradient. */
  sky: [
    { p: 0, color: 0xffe0c4 },
    { p: 1, color: 0xd6ecfa },
    { p: 2, color: 0xa9d4f5 },
    { p: 2.55, color: 0xb6b4ee },
    { p: 3.1, color: 0xff9fa0 },
    { p: 3.5, color: 0x8f8ae0 },
    { p: 4, color: 0x3a3c92 },
    { p: 5, color: 0x0e1040 },
  ] as readonly SkyStop[],
  /** The sky of a lap: both ends are `edge`, so laps join, the middle is `mid`. */
  lapSky: { edge: 0x0e1040, mid: 0x2a1456 },
  /** Rows of the sky gradient are this tall. */
  skyRow: 4,
  /** The house: outer wall inset from the ribbon edge, thickness of the slab between floors, of the ground. */
  house: {
    inset: 30,
    slab: 22,
    ground: 12,
    wall: 0xfbd3b0,
    wallDark: 0xe9b38d,
    beam: 0x9c6a44,
    frame: 0x8a5a3c,
  },
  /** Roof: the wide eave at the foot of the band, the narrower top, tile colours. */
  roof: {
    overhang: 18,
    topY: 122,
    topHalf: 340,
    tile: C.roof.near,
    tileDark: C.roof.nearDark,
    rowHeight: 40,
    chimney: {
      x: 600,
      width: 62,
      top: 36,
      brick: C.roof.brick,
      brickDark: C.roof.brickDark,
      cap: C.roof.chimneyCap,
    },
    smoke: C.roof.smoke,
  },
  mountains: {
    rock: MOUNTAIN_LOOK.rock,
    rockDark: MOUNTAIN_LOOK.rockDark,
    rockBack: MOUNTAIN_LOOK.rockBack,
    rockBackDark: MOUNTAIN_LOOK.rockBackDark,
    snow: MOUNTAIN_LOOK.snow,
    snowDark: MOUNTAIN_LOOK.snowDark,
    peaks: [
      { x: 120, top: 30, half: 270, back: true },
      { x: 680, top: 22, half: 270, back: true },
      { x: 250, top: 66, half: 210, back: false },
      { x: 545, top: 58, half: 210, back: false },
    ],
  },
  kitchen: {
    counterTop: KITCHEN_COLORS.counterTop,
    counter: KITCHEN_COLORS.counter,
    tiles: KITCHEN_COLORS.tiles,
    shelf: KITCHEN_COLORS.shelf,
  },
  /** Cloud bodies: warm white lit side, lilac shadow side. */
  cloud: { fill: 0xfff6f2, far: 0xeadff6 },
  /** The sign of a zone: its size and where its centre sits in the band (offset from the middle of the band), per kind. */
  sign: {
    left: 28,
    width: 280,
    height: 118,
    wood: { fill: 0xc98d62, plank: 0xd9a066, nail: 0x6b4a32 },
    cloud: { fill: 0xffffff, shade: 0xd9d2f0 },
    star: { fill: 0x2c2f78, rim: 0xffc93c },
    shut: { fill: 0xcfc6e6, rim: 0xa79ccb, lock: 0x6e6a8c },
    /** Offset of the sign centre from the band centre, by zone kind (the roof and the laps keep it clear of the picture). */
    centreDy: { kitchen: -10, showcase: -46, roof: 22, clouds: -4, stars: 4, lap: 56 } as Record<
      LandscapeKind,
      number
    >,
    /** The roof sign stands further in: the roof is narrower at its top. */
    leftDx: { roof: 8 } as Partial<Record<LandscapeKind, number>>,
    /** The same for a shut sign (lock and "? ? ?"): kept above the fog edge, which hides the foot of the band under the record. */
    shutDy: { kitchen: -10, showcase: -52, roof: -44, clouds: -44, stars: -44, lap: -44 } as Record<
      LandscapeKind,
      number
    >,
    /** Offsets of the two text rows from the sign centre. */
    rows: [-27, 27] as const,
    /** Padding of the text inside the sign, each side, by sign kind (a cloud is rounder inside). */
    textPad: { wood: 16, cloud: 44, star: 20 } as Record<SignKind, number>,
    /** The lock of a shut sign takes this much of its width on the left. */
    lockRoom: 84,
    /** "? ? ?" of a shut sign: shifted this much from the middle of the room right of the lock, and kept this much narrower than that room. */
    lockTextDx: -6,
    lockTextPad: 28,
    /** The star of the best lap stands this far right of the sign's left edge. */
    bestLapInset: 4,
    /** The best lap label sits this far under the bottom of the sign. */
    bestLapGap: 38,
  },
  /** Fog over the shut part (docs/07, section 2.3). */
  fog: {
    tone: 0xd9d0ee,
    toneLight: 0xece6fa,
    /** Share of the colours of a shut picture taken from the fog: the rest is the silhouette. */
    mix: 0.68,
    /** The silhouette is darkened by this much before it goes into the fog. */
    sink: -0.12,
    /** The edge: a bank of puffs with a bumpy top and a hanging fringe; its height, how far the fringe hangs into the band of the record, and the seeds of the front and back rows. */
    edgeHeight: 214,
    overlap: 46,
    puffs: { count: 9, radius: [34, 60] as const, seed: 7 },
    /** The back row is lighter, has puffs of its own and stands this much higher. */
    backRise: 30,
    backSeed: 19,
    /** Where the centres of the top bumps and of the fringe puffs stand in the picture (from its top, and from its bottom). */
    topBase: 74,
    fringeInset: 78,
    /** Every this many puffs of the fringe hangs lower by `dropExtra`. */
    dropEvery: 3,
    dropExtra: 22,
    /** Soft patches over the body so its tint is not flat: count, alpha. */
    patches: {
      count: 12,
      alpha: 0.4,
      shade: 0.05,
      width: [70, 160] as const,
      height: [26, 56] as const,
    },
    /** The small puffs in the dips between two big ones: their radius and drop, shares of the smaller neighbour. */
    dip: { radius: 0.58, drop: 0.62 },
    /** The slow breathing of the two edge pictures (full level only). */
    breath: { ms: 3600, ease: 'Sine.easeInOut', rise: 7, scale: 0.035, backPhase: 0.5 },
    lock: { size: 64 },
  },
  /** Space laps: how a lap draws its planet and the stars. */
  lap: {
    stars: 26,
    /**
     * The planet of a lap stands in the left column above the sign (the right is the lane of the record flags):
     * scale range (a ringed planet is capped), the box it must fit in, and the right limit when a comet crosses the top.
     */
    planet: {
      scale: [0.28, 0.4] as const,
      ringedMaxScale: 0.3,
      box: { left: 10, top: 8, bottom: 170 },
      right: 262,
      rightWithComet: 215,
    },
    /** The comet of every third lap: its head and the length of its tail (kept clear of the tower column). */
    comet: { x: 300, y: 40, tail: 64 },
    /** Soft nebulae: how many, the stacked layers of each and the alpha of one layer. */
    nebula: {
      count: 2,
      layers: 8,
      layerAlpha: 0.022,
      width: [380, 520] as const,
      height: [150, 220] as const,
    },
    colors: [C.space.nebulaA, C.space.nebulaB, C.space.nebulaC] as readonly number[],
  },
  star: { gold: 0xffe27a, white: 0xffffff },
} as const;

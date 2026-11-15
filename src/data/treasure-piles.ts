import { PALETTE } from './palette';

/** The four steps of a pile of coins or berries: a few pieces, a heap, a bowl or stacks, a basket or a hoard. */
export type PileSize = 1 | 2 | 3 | 4;

export type PileCurrency = 'coins' | 'berries';

/** An amount from this value up gets the pile of the matching size (index 0 is size 1). */
export const PILE_FROM: Readonly<Record<PileCurrency, readonly [number, number, number, number]>> =
  {
    coins: [0, 400, 1000, 3000],
    berries: [0, 200, 800, 2000],
  };

/** What a piece of a pile shows: a baked texture key ('coin', 'berry', a stack of N coins, the bowl, the basket). */
export type PilePieceKind = 'coin' | 'berry' | 'berryFace' | 'bowl' | 'basket' | `stack${number}`;

/** One picture of a pile: centre as shares of the pile box (-0.5..0.5), width as a share of the box. */
export interface PilePiece {
  kind: PilePieceKind;
  x: number;
  y: number;
  w: number;
  /** Tilt, degrees. */
  tiltDeg?: number;
}

/** Pieces back to front. */
export const PILE_PIECES: Readonly<
  Record<PileCurrency, Readonly<Record<PileSize, readonly PilePiece[]>>>
> = {
  berries: {
    1: [{ kind: 'berryFace', x: 0, y: 0.02, w: 0.95 }],
    2: [
      { kind: 'berry', x: 0, y: -0.2, w: 0.64 },
      { kind: 'berry', x: -0.2, y: 0.1, w: 0.64, tiltDeg: -12 },
      { kind: 'berry', x: 0.2, y: 0.12, w: 0.64, tiltDeg: 12 },
    ],
    3: [
      { kind: 'berry', x: -0.22, y: -0.2, w: 0.55, tiltDeg: -10 },
      { kind: 'berry', x: 0.22, y: -0.2, w: 0.55, tiltDeg: 10 },
      { kind: 'berry', x: 0, y: -0.28, w: 0.55 },
      { kind: 'bowl', x: 0, y: 0.18, w: 1 },
    ],
    4: [
      { kind: 'berry', x: -0.28, y: -0.18, w: 0.5, tiltDeg: -14 },
      { kind: 'berry', x: 0.28, y: -0.18, w: 0.5, tiltDeg: 14 },
      { kind: 'berry', x: 0, y: -0.36, w: 0.5 },
      { kind: 'berry', x: -0.12, y: -0.12, w: 0.5, tiltDeg: -5 },
      { kind: 'berry', x: 0.14, y: -0.14, w: 0.5, tiltDeg: 6 },
      { kind: 'basket', x: 0, y: 0.2, w: 1 },
    ],
  },
  coins: {
    1: [{ kind: 'stack3', x: 0, y: 0.04, w: 0.8 }],
    2: [
      { kind: 'stack4', x: -0.22, y: 0, w: 0.58 },
      { kind: 'stack2', x: 0.24, y: 0.2, w: 0.58 },
    ],
    3: [
      { kind: 'stack5', x: -0.26, y: -0.08, w: 0.52 },
      { kind: 'stack4', x: 0.26, y: -0.04, w: 0.52 },
      { kind: 'stack3', x: 0, y: 0.14, w: 0.52 },
      { kind: 'coin', x: 0.06, y: 0.36, w: 0.34, tiltDeg: 8 },
    ],
    4: [
      { kind: 'stack5', x: -0.3, y: -0.14, w: 0.46 },
      { kind: 'stack5', x: 0.3, y: -0.12, w: 0.46 },
      { kind: 'stack5', x: 0, y: -0.02, w: 0.46 },
      { kind: 'stack3', x: -0.2, y: 0.22, w: 0.46 },
      { kind: 'coin', x: 0.24, y: 0.34, w: 0.32, tiltDeg: 8 },
    ],
  },
};

/** Looks of the drawn pieces: the coin stacks, the bowl and the basket. Sizes are texture pixels. */
export const PILE_LOOK = {
  /** Heights (coin counts) of the baked stacks. */
  stackCounts: [2, 3, 4, 5],
  stack: {
    width: 84,
    coinHeight: 20,
    /** Each coin sits this share of its height above the last, so the outlines overlap. */
    step: 0.7,
    outline: 5,
    base: 0xffc93c,
    shadow: 0xe8a424,
    /** The lit coin is smaller by this share and pushed to the top left (the flat shadow band). */
    band: 0.12,
    gloss: 0xfffbe0,
  },
  bowl: {
    width: 220,
    height: 120,
    pad: 8,
    outline: 6,
    base: PALETTE.accentSecondary,
    shadow: 0x5b3fd0,
    rim: 0x9a82ff,
    rimShadow: 0x7c5cff,
    /** Rim bar: height and overhang, as shares of the bowl size. */
    rimHeightShare: 0.2,
    rimOverhang: 0.04,
    band: 0.1,
    gloss: 0xffffff,
  },
  basket: {
    width: 220,
    height: 128,
    pad: 8,
    outline: 6,
    base: 0xd9a066,
    shadow: 0xb9794a,
    rim: 0xe9b57a,
    rimShadow: 0xc98d62,
    rimHeightShare: 0.18,
    rimOverhang: 0.04,
    band: 0.1,
    /** Weave: rows of strokes in the outline tone. */
    weaveRows: 3,
    weaveThick: 5,
    weaveColumns: 5,
    gloss: 0xffffff,
  },
  /** The gloss mark on the drawn pieces (shares of the piece width). */
  gloss: {
    x: -0.32,
    y: -0.1,
    length: 0.16,
    thick: 0.045,
    tiltDeg: -25,
    dotGap: 0.05,
    dotRadius: 0.022,
  },
  /** Idle: the pile rises and falls, each one out of step with the others. */
  idle: { bobPx: 3, bobPeriodMs: 3800, phaseSpreadMs: 900 },
} as const;

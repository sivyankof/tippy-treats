import { Rng } from '../../core/rng';
import { CUT_LOOK, type CutVariantName } from '../../data/cut-look';
import type { EffectLevel } from '../../data/effect-levels';

/** What a cut shows besides the crumbs. */
export interface CutVariant {
  /** The bitten-off part falls as a piece; a thin sliver gives only crumbs. */
  piece: boolean;
  /** Glaze strands between the layer and the piece. */
  strands: boolean;
  /** The piece is scared and waves its arms. */
  panic: boolean;
  /** A big piece (strands and panic); at most one in `bigEveryLayers` layers. */
  big: boolean;
}

export interface CutChoice {
  /** Cosmetic seed of the run (`plainLooks.cosmeticSeed`). */
  seed: number;
  /** 1-based number of the layer that was cut. */
  layerNumber: number;
  /** Width of the piece as a share of the layer width before the cut. */
  share: number;
  /** Width of the piece, px. */
  pieceWidth: number;
  /** Number of the layer of the last big piece of this run, `null` when there was none. */
  lastBigLayer: number | null;
}

const PLAIN: CutVariant = { piece: true, strands: false, panic: false, big: false };

/** A piece wide enough to carry a face. */
export function roomForFace(pieceWidth: number): boolean {
  return pieceWidth >= CUT_LOOK.panicMinWidth;
}

/**
 * The variant of one cut. The draws come from the cosmetic stream of the run keyed by the layer
 * number, so the daily tower gives everybody the same cuts and the sim and the score never see
 * it. Both chances are drawn every time, so one never shifts the other.
 */
export function chooseCutVariant(choice: CutChoice): CutVariant {
  if (choice.share < CUT_LOOK.thinShare) return { ...PLAIN, piece: false };
  const random = new Rng(choice.seed).fork(CUT_LOOK.stream).fork(String(choice.layerNumber));
  const strandRoll = random.next();
  const panicRoll = random.next();
  const face = roomForFace(choice.pieceWidth);
  const bigAllowed =
    choice.lastBigLayer === null ||
    choice.layerNumber - choice.lastBigLayer >= CUT_LOOK.bigEveryLayers;
  if (choice.share > CUT_LOOK.bigShare && bigAllowed) {
    return { piece: true, strands: true, panic: face, big: true };
  }
  return {
    piece: true,
    strands: strandRoll < CUT_LOOK.strandChance,
    panic: face && panicRoll < CUT_LOOK.panicChance,
    big: false,
  };
}

/** The variant a forced name stands for (the dev hook and the benchmark), whatever the piece is like. */
export function forcedCutVariant(name: CutVariantName): CutVariant {
  switch (name) {
    case 'plain':
      return PLAIN;
    case 'strands':
      return { ...PLAIN, strands: true };
    case 'panic':
      return { ...PLAIN, panic: true };
    case 'big':
      return { piece: true, strands: true, panic: true, big: true };
  }
}

/** What a cut plays at an effects level; `null` at the minimal level: the piece just falls, as it used to. */
export interface CutPlan {
  /** Number of crumbs ([min, max]; the lite level gives a fixed count). */
  crumbs: readonly [number, number];
  strands: boolean;
  panic: boolean;
  /** The drop that stays on the cut edge of the layer. */
  trace: boolean;
}

export function cutPlanFor(level: EffectLevel, variant: CutVariant): CutPlan | null {
  if (level === 'minimal') return null;
  if (level === 'lite') {
    const n = CUT_LOOK.crumbs.lite;
    return { crumbs: [n, n], strands: false, panic: false, trace: false };
  }
  return {
    crumbs: CUT_LOOK.crumbs.full,
    strands: variant.strands,
    panic: variant.panic,
    trace: variant.strands,
  };
}

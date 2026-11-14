import { Rng } from '../../core/rng';
import type { LayerColors } from '../../data/palette';
import {
  DECOR_KINDS,
  PLAIN_LAYER,
  PLAIN_PAIRS,
  SPONGES,
  type DecorKind,
  type PlainPair,
} from '../../data/plain-layers';

/** What a plain layer looks like: its "sponge + glaze" pair and its decoration (or none). */
export interface PlainLook {
  pair: number;
  decor: DecorKind | null;
}

/** Decoration slots in a look code: 0 is "no decoration", then one per kind. */
const DECOR_SLOTS = DECOR_KINDS.length + 1;

/** Look code of the golden layer: past every plain code, so it has art of its own. */
export const GOLDEN_LOOK = PLAIN_PAIRS.length * DECOR_SLOTS;

/** One number per look (the texture key and the art slot compare it). */
export function lookCode(look: PlainLook): number {
  const decor = look.decor === null ? 0 : DECOR_KINDS.indexOf(look.decor) + 1;
  return look.pair * DECOR_SLOTS + decor;
}

/** The look behind a plain look code. */
export function lookOfCode(code: number): PlainLook {
  const slot = code % DECOR_SLOTS;
  return {
    pair: Math.floor(code / DECOR_SLOTS) % PLAIN_PAIRS.length,
    decor: slot === 0 ? null : (DECOR_KINDS[slot - 1] ?? null),
  };
}

/** Seed of the cosmetic stream of a run. */
export function cosmeticSeedOf(runSeed: number): number {
  return new Rng(runSeed).fork(PLAIN_LAYER.cosmeticStream).seed;
}

/** The order of the pairs in block `block` of layers, before the fix at the block start. */
function blockOrder(seed: number, block: number): number[] {
  const rng = new Rng(seed).fork(`pairs:${block}`);
  const order = PLAIN_PAIRS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * Pair of the plain layer with this 1-based number. The layers go in blocks of one pair each, in
 * an order shuffled per block; a block never starts with the pair the block before ended with.
 * Nothing depends on the other layers drawn, so a layer always gets the same pair.
 */
export function pairAt(seed: number, layerIndex: number): number {
  const n = PLAIN_PAIRS.length;
  const i = Math.max(0, layerIndex - 1);
  const block = Math.floor(i / n);
  const order = blockOrder(seed, block);
  // The fix swaps the first two of a block, which never moves the last one (n > 2).
  if (block > 0 && order[0] === blockOrder(seed, block - 1)[n - 1]) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order[i % n]!;
}

/** The look of the plain layer with this 1-based number, for the cosmetic `seed`. */
export function plainLookAt(seed: number, layerIndex: number): PlainLook {
  const pair = pairAt(seed, layerIndex);
  const rng = new Rng(seed).fork(`decor:${layerIndex}`);
  const options = PLAIN_PAIRS[pair]!.decor;
  const decorated = rng.next() < PLAIN_LAYER.decorShare && options.length > 0;
  return { pair, decor: decorated ? options[rng.int(0, options.length - 1)]! : null };
}

/** Sponge and glaze colours of a pair. */
export function pairColors(pair: number): LayerColors {
  const p: PlainPair = PLAIN_PAIRS[pair] ?? PLAIN_PAIRS[0]!;
  return { cake: SPONGES[p.sponge].cake, glaze: p.glaze };
}

/**
 * The looks of the plain layers of the current run: set from the run seed when a run starts,
 * remembered per layer so the views ask for them every frame for free.
 */
class PlainLooks {
  private seed = cosmeticSeedOf(0);
  private codes: number[] = [];

  /** A new run: its seed decides every plain layer. */
  setRunSeed(runSeed: number): void {
    const seed = cosmeticSeedOf(runSeed);
    if (seed === this.seed) return;
    this.seed = seed;
    this.codes = [];
  }

  /** Seed of the cosmetic stream of the current run. */
  get cosmeticSeed(): number {
    return this.seed;
  }

  /** Look code of the plain layer with this 1-based number. */
  codeFor(layerIndex: number): number {
    const known = this.codes[layerIndex];
    if (known !== undefined) return known;
    const code = lookCode(plainLookAt(this.seed, layerIndex));
    this.codes[layerIndex] = code;
    return code;
  }

  /** Sponge and glaze colours of the plain layer with this 1-based number. */
  colorsFor(layerIndex: number): LayerColors {
    return pairColors(lookOfCode(this.codeFor(layerIndex)).pair);
  }
}

export const plainLooks = new PlainLooks();

import { CUT_VARIANT_NAMES, type CutVariantName } from '../../data/cut-look';
import type { SquashKind } from '../../data/topper-squash';

/** The decorations the panel can squash, in the order of its buttons. */
export const SQUASH_BUTTON_KINDS: readonly SquashKind[] = [
  'cherry',
  'strawberry',
  'lemon',
  'mint',
  'wafer',
  'cream',
];

type TriggerWindow = Window & {
  tippyCut?: (variant?: CutVariantName) => boolean;
  tippySquash?: (kind: SquashKind, mode?: 'hit' | 'edge' | 'none') => boolean;
};

/** The cut variants the panel offers (the same names `window.tippyCut` takes). */
export const CUT_BUTTON_VARIANTS: readonly CutVariantName[] = CUT_VARIANT_NAMES;

/** Panel button: the next cut goes the given way, like `window.tippyCut(variant)`. False when the run has no hook (no run on screen). */
export function triggerCut(variant: CutVariantName): boolean {
  return (window as TriggerWindow).tippyCut?.(variant) ?? false;
}

/** Panel button: the next layer lands on the given decoration, like `window.tippySquash(kind, 'hit')`. */
export function triggerSquash(kind: SquashKind): boolean {
  return (window as TriggerWindow).tippySquash?.(kind, 'hit') ?? false;
}

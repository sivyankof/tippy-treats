import type { CutSide } from '../../core/drop';
import { PLAIN_LAYER, type DecorKind } from '../../data/plain-layers';
import { GOLDEN } from '../../util/math';
import { cutStripWidth, glazeCrestY } from './glaze-wave';
import type { LayerBox } from './layer-draw';

const D = PLAIN_LAYER.decor;
/** A second irrational step, so the y and the variant of a decoration do not follow its angle. */
const PLASTIC = 0.754878;
/** Gap between a berry, flower or nut and the crest under it. */
const CREST_GAP = 3;
/** The base of a cream swirl sits this many radii above the crest. */
const CREAM_BASE = 0.5;
/** The right side starts half a cycle on, so it is not a mirror of the left one. */
const RIGHT_PHASE = 0.5;

/** One decoration: where it sits, how it is turned (radians) and which of its variants it is (0..1). */
export interface DecorItem {
  x: number;
  y: number;
  angle: number;
  variant: number;
}

/** Half the width a decoration takes. */
export function decorReach(kind: DecorKind): number {
  switch (kind) {
    case 'sprinkles':
      return (D.sprinkles.length + D.sprinkles.width) / 2;
    case 'berries':
      return D.berries.radius;
    case 'flowers':
      return D.flowers.spread + D.flowers.petal;
    case 'nuts':
      return D.nuts.width / 2;
    case 'cream':
      return D.cream.radius;
  }
}

function pitchOf(kind: DecorKind): number {
  return D[kind].pitch;
}

/** Y of a decoration: in the glaze band, a sprinkle anywhere in it, cream low on the crest. */
function decorY(kind: DecorKind, box: LayerBox, crestY: number, shift: number): number {
  const reach = decorReach(kind);
  switch (kind) {
    case 'sprinkles': {
      const room = Math.max(0, crestY - box.innerTop - reach * 2);
      return box.innerTop + reach + room * shift;
    }
    case 'cream':
      // Sitting low in the glaze, so the layer above never hides it.
      return crestY - reach * CREAM_BASE;
    default:
      return crestY - reach - CREST_GAP;
  }
}

/**
 * The decorations of a plain layer: in the glaze band, on both sides of the face, never in
 * front of it (`faceHalf` either side of the centre, plus a margin; `null`: a faceless piece,
 * filled to the middle) and never on the sponge of a bitten edge. Each side is filled from its outer edge inwards at the kind's pitch, so the
 * decorations of the intact side stay where they were after a bite.
 */
export function decorItems(
  kind: DecorKind,
  box: LayerBox,
  cut: CutSide | null,
  faceHalf: number | null,
): DecorItem[] {
  const reach = decorReach(kind);
  const pitch = pitchOf(kind);
  const strip = cut ? cutStripWidth(box) : 0;
  const crestY = glazeCrestY(box);
  const faceEdge = faceHalf === null ? 0 : faceHalf + D.faceMargin;
  const items: DecorItem[] = [];
  for (const side of [-1, 1] as const) {
    const bitten = (side === -1 && cut === 'left') || (side === 1 && cut === 'right');
    const edge = (side === -1 ? box.innerLeft : box.innerRight) - side * (bitten ? strip : 0);
    const start = edge - side * D.edgeInset;
    const phase = side === 1 ? RIGHT_PHASE : 0;
    for (let k = 0; ; k++) {
      const x = start - side * pitch * (k + 0.5);
      // The inner end of the decoration must stay clear of the face.
      if (side === -1 ? x + reach > -faceEdge : x - reach < faceEdge) break;
      const f = ((k + 1) * GOLDEN + phase) % 1;
      const g = ((k + 1) * PLASTIC + phase) % 1;
      items.push({
        x,
        y: decorY(kind, box, crestY, g),
        angle: f * Math.PI,
        variant: (f + g) % 1,
      });
    }
  }
  return items;
}

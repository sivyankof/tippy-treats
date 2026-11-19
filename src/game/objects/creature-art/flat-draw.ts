import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { CREATURE_STYLE } from '../../../data/creatures/creature-style';
import { PALETTE } from '../../../data/common/palette';
import { drawGlossMark, type GlossMark } from '../../fx/plain-style';
import { DRIP_WIDTH, glazeLayout, type GlazeOptions, type LayerBox } from '../layer-draw';
import type { CreatureColors } from './primitives';

/** Outline in the tone of the creature, the flat shadow tone, then the lit tone above a shadow band. */
export function drawBody(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  colors: CreatureColors,
): void {
  const band = box.innerH * CREATURE_STYLE.shadowShare;
  g.fillStyle(colors.outline, 1);
  g.fillRoundedRect(box.left, box.top, box.width, box.height, box.radius);
  g.fillStyle(colors.shadow, 1);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, box.innerH, box.innerRadius);
  g.fillStyle(colors.body, 1);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, box.innerH - band, {
    tl: box.innerRadius,
    tr: box.innerRadius,
    bl: 0,
    br: 0,
  });
}

/** The three passes of a flat glaze: outline (grown), shadow tone, lit tone (its lower edge lifted by the band). */
function glazePasses(colors: CreatureColors): ReadonlyArray<{
  color: number;
  grow: number;
  lift: number;
}> {
  const { outline } = ANIM.layer;
  return [
    { color: colors.glazeOutline, grow: outline / 2, lift: 0 },
    { color: colors.glazeShadow, grow: 0, lift: 0 },
    { color: colors.glaze, grow: 0, lift: CREATURE_STYLE.glaze.band },
  ];
}

/**
 * Glaze on the top of the layer with drips or a wavy edge below it: flat, in two tones. The
 * lit tone is the same shape lifted, so a shadow band stays along every lower edge.
 */
export function drawGlaze(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  colors: CreatureColors,
  options: GlazeOptions = {},
): void {
  const { edgeY, scallops, drips } = glazeLayout(box, options);
  const glazeH = edgeY - box.innerTop;
  const topCorners = { tl: box.innerRadius, tr: box.innerRadius, bl: 0, br: 0 };

  for (const { color, grow, lift } of glazePasses(colors)) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(
      box.innerLeft - grow,
      box.innerTop - grow,
      box.innerW + grow * 2,
      glazeH + grow - lift,
      topCorners,
    );
    for (const bump of scallops) g.fillCircle(bump.x, edgeY - lift, bump.radius + grow);
    for (const drip of drips) {
      const w = DRIP_WIDTH + grow * 2;
      g.fillRoundedRect(
        drip.x - w / 2,
        edgeY - DRIP_WIDTH / 2,
        w,
        drip.length + DRIP_WIDTH / 2 + grow - lift,
        w / 2,
      );
    }
  }
}

/** Where the gloss may go when the default spot does not suit the layer. */
export interface GlossSpot {
  /** Middle of the stroke below the top edge (default: `CREATURE_STYLE.gloss.y`). */
  y?: number;
  /** The mark must end left of this x (layer centre is 0): keeps it off a face that starts there. */
  clearTo?: number;
  /** Distance of the stroke's start from the left edge (default: `CREATURE_STYLE.gloss.inset`, shrunk on a narrow layer). */
  inset?: number;
}

/** The short white stroke and the dot after it near the top-left corner, for a layer of this box. */
export function glossMarkFor(box: LayerBox, scale = 1, spot: GlossSpot = {}): GlossMark | null {
  const s = CREATURE_STYLE.gloss;
  let length = Math.min(s.length * scale, box.width * s.maxWidthShare);
  const inset = spot.inset ?? Math.min(s.inset, Math.max(s.minInset, box.width * s.maxWidthShare));
  if (spot.clearTo !== undefined) {
    // Shrink the stroke until the dot ends before `clearTo`: reach = length * (1 + dot/length) + gap.
    const room = spot.clearTo - (box.left + inset) - s.dotGap;
    length = Math.min(length, room / (1 + s.dotRadius / s.length));
    if (length < s.minLength) return null;
  }
  const dotRadius = (s.dotRadius * length) / s.length;
  const reach = length + s.dotGap + dotRadius;
  if (length <= 0 || inset + reach > box.width - inset) return null;
  return {
    x: box.left + inset + length / 2,
    y: box.top + (spot.y ?? s.y),
    length,
    thick: (s.thick * length) / s.length,
    tilt: 0,
    dotGap: s.dotGap,
    dotRadius,
    color: PALETTE.textLight,
    alpha: s.alpha,
  };
}

/** The highlight of a creature layer: a short stroke and a dot, as on the plain layers. */
export function drawGloss(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  scale = 1,
  spot: GlossSpot = {},
): void {
  const mark = glossMarkFor(box, scale, spot);
  if (mark) drawGlossMark(g, mark);
}

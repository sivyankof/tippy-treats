import type { CreatureId } from './creatures';

/**
 * Common look of the creature layers (docs/06, section 3, "Общая манера существ"): a flat body in
 * two tones, a flat glaze in two tones, a short gloss, all outlined in a dark tone of the
 * creature's own colour.
 */
export const CREATURE_STYLE = {
  /** Height of the flat shadow band at the bottom of the body, as a share of the inner height. */
  shadowShare: 0.3,
  /** Share of the outline colour mixed into a body tone to get its shadow tone. */
  shadowMix: 0.3,
  /** The shadow band laid over the pattern that covers the bottom of the body: outline colour at this opacity. */
  coverShadowAlpha: 0.2,
  glaze: {
    /** The glaze outline: the glaze darkened (`GLAZE_OUTLINE`) with this share of the creature outline mixed in. */
    outlineMix: 0.55,
    /** Share of the glaze outline mixed into the glaze to get its shadow tone. */
    shadowMix: 0.4,
    /** Height of the shadow band at the lower edge of the glaze, drips and scallops, in pixels. */
    band: 8,
  },
  /** The short white stroke and the dot after it, near the top-left corner. */
  gloss: {
    /** Distance of the stroke's start from the left edge and of its middle from the top edge, in pixels. */
    inset: 40,
    y: 17,
    length: 38,
    thick: 9,
    dotGap: 7,
    dotRadius: 4.5,
    alpha: 0.92,
    /** On a narrow layer the stroke is at most this share of the width. */
    maxWidthShare: 0.26,
    /** A stroke squeezed shorter than this (by a face beside it) is left out. */
    minLength: 14,
    /** Free space kept between the gloss and a face, in pixels. */
    faceGap: 8,
    /** Below this width the inset shrinks with the layer. */
    minInset: 14,
    /** Y of the Twins gloss when it moves below the face row of a narrow layer. */
    twinsLowY: 54,
    /** Below this face scale the low Twins gloss no longer steers clear of the left mouth. */
    twinsClearScale: 0.7,
    /** The jelly shines more: its gloss is this much bigger. */
    jellyScale: 1.35,
  },
} as const;

/** Icons of the creatures, baked at start-up from the real layer picture with its face. */
export const CREATURE_ICON = {
  /** Width of the layer the icon is drawn from: narrow, so the layer face shrinks and the picture fills the square. */
  layerWidth: 150,
  /** Wider layers for the creatures whose face is a pair: at the common width the two faces shrink to dots. */
  layerWidthById: { twins: 180 } as Readonly<Partial<Record<CreatureId, number>>>,
  /** Level the icon layers are set to (the level shows nowhere in the picture). */
  level: 1,
  /** Side of the baked square texture in pixels. */
  size: 216,
  /** Empty margin around the picture, as a share of the square side. */
  marginShare: 0.04,
} as const;

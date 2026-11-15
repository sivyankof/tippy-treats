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

/**
 * The sleeping silhouette of a locked creature (docs/06, "Спящие силуэты"): the creature's own
 * layer picture in muted tones of its own hue, closed-eye arcs instead of a face, floating "z".
 */
export const CREATURE_SLEEP = {
  palette: {
    /** Share of the outline's saturation the body keeps. */
    saturation: 0.6,
    /** Lightness of the body, and how much of the real body's offset from 0.5 it keeps. */
    bodyLightness: 0.5,
    keepLightness: 0.3,
    /** The glaze is this much darker than the body, or lighter when the real glaze is lighter. */
    glazeStep: 0.1,
    /** The outline: dark and a little less saturated than the real one. */
    outlineLightness: 0.26,
    outlineSaturation: 0.6,
  },
  /** A closed eye: a lower arc (like a bowl) of this half width and depth, drawn this thick; sizes at face scale 1. */
  eyes: { halfWidth: 20, depth: 11, thick: 7, steps: 12, clearance: 4 },
  /** Slow breathing instead of the old bob: one breath every `periodMs`. */
  breath: { periodMs: 3400, scaleX: 0.012, scaleY: 0.03 },
  /** The floating letters: size and the way up are in pixels at scale 1, anchored over the right top of the layer. */
  zs: {
    glyph: 'z',
    count: 3,
    font: 104,
    /** The letters take the muted body tone, lightened by this much. */
    lighten: 0.2,
    /** Letter sizes from the first to the last, as shares of `font`. */
    sizeShares: [0.7, 0.85, 1],
    periodMs: 2600,
    rise: 80,
    /** Half the height of the biggest letter as a share of `font`, and the least share of the rise a cramped place still gets. */
    glyphHalfShare: 0.4,
    minRiseShare: 0.3,
    drift: 34,
    /** Where the first letter starts: from the centre of the layer, as a share of its half width, and in pixels above its top edge. */
    anchorX: 0.55,
    anchorLift: 4,
    /** Share of the loop spent fading in, and fading out. */
    fadeIn: 0.2,
    fadeOut: 0.35,
    /** The letters grow from this share of their size while they rise. */
    growFrom: 0.6,
    popMs: 220,
    popEase: 'Back.easeOut',
  },
  /** Waking up in the reveal: a pause with the letters, then the cross-fade into the real creature. */
  wake: { holdMs: 160, fadeMs: 220 },
} as const;

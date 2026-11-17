/**
 * The clip guard (docs/06 section 1, "Поле картинки"; docs/08 section 9): after a picture is
 * baked on the art sheet page (dev build), it is drawn a second time into a field bigger on every
 * side, and a picture with noticeably opaque pixels in that margin is cut off by its own field.
 */

export type ClipSide = 'top' | 'right' | 'bottom' | 'left';

export const CLIP_SIDES: readonly ClipSide[] = ['top', 'right', 'bottom', 'left'];

/** The probe draws a picture again into a field this many pixels bigger on every side; what lands in the margin is what the real field cuts off. */
export const CLIP_PROBE_PAD = 48;

/** The free field the style asks for between a drawing and the edge of its picture, px (docs/06 section 1); less is reported as tight, a drawing past the edge as cut off. */
export const CLIP_MIN_SPARE = 3;

/** A pixel of the margin counts as drawn when its alpha (0..255) is above this. */
export const CLIP_ALPHA_THRESHOLD = 24;

/** A picture that runs past its field by design: keys matching `match` (on `sides`; every side when left out). */
export interface ClipAllowance {
  match: RegExp;
  sides?: readonly ClipSide[];
  reason: string;
}

export const CLIP_ALLOWED: readonly ClipAllowance[] = [
  {
    match: /^bd_(k_(wallpaper|shelves)|r_(far|mid|near)(_|$)|s_street_|shop_(lattice|shelves))/,
    reason:
      'tiled backdrop layers: the scenery is drawn past the tile on purpose, so the cut is a straight edge that repeats (TileSprite)',
  },
  {
    match: /^bd_mountains/,
    sides: ['bottom'],
    reason: 'the hills run down past the bottom edge of their picture; the screen covers the cut',
  },
  {
    match: /^bd_s_wire$/,
    sides: ['left', 'right'],
    reason:
      'the garland wire runs from edge to edge of its picture and is laid end to end across the screen',
  },
  {
    match: /^shade_cap_/,
    sides: ['right', 'bottom'],
    reason:
      'a rounded corner larger than the picture, cropped to the band on purpose (the picture is a cut of a bigger shape)',
  },
];

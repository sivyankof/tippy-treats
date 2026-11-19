import { BACKDROP_COLORS, ZONE_SKY } from '../backdrop/backdrop-colors';
import { PALETTE } from '../common/palette';
import type { ZoneId } from './zones';
import { mixColor } from '../../util/color';

/**
 * The zone pictures of the "Where from?" window (docs/07-ui-screens.md, section 2.1) and the
 * numbers of the window itself. The pictures are drawn like the plain layers
 * (docs/06-art-animation-audio.md, "Манера картинок"): a rounded badge in the colour of the
 * zone sky with a small emblem on it. Sizes are shares of the picture size unless said otherwise.
 */

/** A part of an emblem; a group of parts is drawn as one silhouette (one outline around all). */
export type EmblemShape =
  | { kind: 'round'; radius: number }
  | { kind: 'ellipse' }
  | { kind: 'triangle' }
  | { kind: 'star'; inner: number };

export interface EmblemPart {
  shape: EmblemShape;
  /** Centre and half sizes. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  fill: number;
  /** The flat shadow tone; the fill darkened by `CHECKPOINT_LOOK.shadowShade` when left out. */
  shadow?: number;
}

const kitchen = BACKDROP_COLORS.kitchen;
const showcase = BACKDROP_COLORS.showcase;
const roof = BACKDROP_COLORS.roof;
const clouds = BACKDROP_COLORS.clouds;
const stars = BACKDROP_COLORS.stars;
const space = BACKDROP_COLORS.space;

const CLOUD_TONES = { fill: clouds.near, shadow: clouds.mid } as const;

/** Emblem of each zone: groups drawn back to front, parts of a group merge into one silhouette. */
export const ZONE_EMBLEMS: Record<ZoneId, readonly (readonly EmblemPart[])[]> = {
  // A cooking pot with a lid and a pink knob.
  kitchen: [
    [
      { shape: { kind: 'ellipse' }, x: 0.2, y: 0.57, rx: 0.075, ry: 0.05, fill: kitchen.pot },
      { shape: { kind: 'ellipse' }, x: 0.8, y: 0.57, rx: 0.075, ry: 0.05, fill: kitchen.pot },
    ],
    [
      {
        shape: { kind: 'round', radius: 0.12 },
        x: 0.5,
        y: 0.6,
        rx: 0.27,
        ry: 0.17,
        fill: kitchen.pot,
        shadow: kitchen.potDark,
      },
    ],
    [
      {
        shape: { kind: 'round', radius: 0.1 },
        x: 0.5,
        y: 0.42,
        rx: 0.25,
        ry: 0.065,
        fill: kitchen.ladle,
        shadow: kitchen.ladleDark,
      },
    ],
    [{ shape: { kind: 'ellipse' }, x: 0.5, y: 0.31, rx: 0.055, ry: 0.045, fill: kitchen.mug }],
  ],
  // A cake with pink glaze and a cherry on a stand.
  showcase: [
    [
      {
        shape: { kind: 'round', radius: 0.06 },
        x: 0.5,
        y: 0.76,
        rx: 0.33,
        ry: 0.04,
        fill: showcase.standBase,
      },
    ],
    [
      {
        shape: { kind: 'round', radius: 0.08 },
        x: 0.5,
        y: 0.6,
        rx: 0.26,
        ry: 0.13,
        fill: showcase.cake,
      },
    ],
    [
      {
        shape: { kind: 'round', radius: 0.14 },
        x: 0.5,
        y: 0.45,
        rx: 0.27,
        ry: 0.085,
        fill: showcase.glaze,
      },
    ],
    [{ shape: { kind: 'ellipse' }, x: 0.5, y: 0.31, rx: 0.06, ry: 0.06, fill: showcase.cherry }],
  ],
  // A house with a brick chimney.
  roof: [
    [
      {
        shape: { kind: 'round', radius: 0.03 },
        x: 0.65,
        y: 0.3,
        rx: 0.055,
        ry: 0.12,
        fill: roof.brick,
        shadow: roof.brickDark,
      },
    ],
    [
      {
        shape: { kind: 'round', radius: 0.05 },
        x: 0.5,
        y: 0.67,
        rx: 0.22,
        ry: 0.14,
        fill: roof.mid,
        shadow: roof.midDark,
      },
    ],
    [
      {
        shape: { kind: 'triangle' },
        x: 0.5,
        y: 0.46,
        rx: 0.32,
        ry: 0.2,
        fill: roof.near,
        shadow: roof.nearDark,
      },
    ],
  ],
  // A puffy cloud.
  clouds: [
    [
      { shape: { kind: 'ellipse' }, x: 0.33, y: 0.56, rx: 0.15, ry: 0.13, ...CLOUD_TONES },
      { shape: { kind: 'ellipse' }, x: 0.52, y: 0.46, rx: 0.2, ry: 0.18, ...CLOUD_TONES },
      { shape: { kind: 'ellipse' }, x: 0.69, y: 0.58, rx: 0.15, ry: 0.12, ...CLOUD_TONES },
      {
        shape: { kind: 'round', radius: 0.1 },
        x: 0.5,
        y: 0.64,
        rx: 0.29,
        ry: 0.09,
        ...CLOUD_TONES,
      },
    ],
  ],
  // A big star with two small ones.
  stars: [
    [
      {
        shape: { kind: 'star', inner: 0.5 },
        x: 0.76,
        y: 0.24,
        rx: 0.1,
        ry: 0.1,
        fill: stars.warm,
      },
    ],
    [
      {
        shape: { kind: 'star', inner: 0.5 },
        x: 0.22,
        y: 0.76,
        rx: 0.09,
        ry: 0.09,
        fill: stars.warm,
      },
    ],
    [
      {
        shape: { kind: 'star', inner: 0.5 },
        x: 0.52,
        y: 0.52,
        rx: 0.27,
        ry: 0.27,
        fill: stars.moon,
        shadow: stars.moonCrater,
      },
    ],
  ],
  // A ringed planet with a small moon.
  space: [
    [
      {
        shape: { kind: 'ellipse' },
        x: 0.5,
        y: 0.54,
        rx: 0.38,
        ry: 0.11,
        fill: space.ring,
      },
    ],
    [
      {
        shape: { kind: 'ellipse' },
        x: 0.5,
        y: 0.5,
        rx: 0.22,
        ry: 0.22,
        fill: space.planetA,
        shadow: space.planetABand,
      },
    ],
    [{ shape: { kind: 'ellipse' }, x: 0.77, y: 0.25, rx: 0.07, ry: 0.07, fill: space.rock }],
  ],
};

export const CHECKPOINT_LOOK = {
  /** Size of the baked picture in texture pixels. */
  textureSize: 160,
  /** Badge: corner radius (share of the half size) and the flat shadow band (share of the half size). */
  badge: { radius: 0.42, band: 0.1 },
  /** The flat shadow tone of a fill is this much darker. */
  shadowShade: -0.16,
  /** Emblem outline against the badge outline (the parts are small). */
  emblemOutline: 0.55,
  /** The lit emblem part is smaller by this share and pushed to the top left: the flat band stays. */
  emblemBand: 0.14,
  gloss: {
    x: -0.5,
    y: -0.5,
    length: 0.16,
    thick: 0.04,
    tiltDeg: -45,
    dotGap: 0.05,
    dotRadius: 0.02,
    alpha: 0.85,
  },
} as const;

/** The badge colour of a zone: the middle colour of its sky (or the mix of the two ends). */
export function zoneBadgeColor(zone: ZoneId): number {
  const sky = ZONE_SKY[zone];
  const first = sky[0];
  const last = sky[sky.length - 1];
  const middle = sky.length > 2 ? sky[Math.floor(sky.length / 2)] : undefined;
  if (middle) return middle.color;
  return first && last ? mixColor(first.color, last.color, 0.5) : PALETTE.panel;
}

/** Layout of the "Where from?" window (content coordinates of the popup, pixels). */
export const CHECKPOINT_WINDOW = {
  /** The berry balance row at the top. */
  balanceHeight: 90,
  balanceGap: 18,
  /** A step of the climb: its height, the gap under it and how far each next step shifts to the side. */
  stepHeight: 128,
  stepGap: 14,
  stepShift: 36,
  /** Picture in a step (display size) and the padding inside the step. */
  pictureSize: 104,
  stepPad: 18,
  textGap: 18,
  /** Width kept on the right of a step for the price (or the lock). */
  priceWidth: 150,
  /** The two text lines of a step stand this far above and below its middle. */
  lineOffset: 26,
  lockedPictureAlpha: 0.7,
  nameFont: 42,
  layerFont: 30,
  priceFont: 40,
  freeFont: 34,
  fills: { open: 0x7c5cff, selected: 0xff5c8a, locked: 0x9a8fa8 },
  selectedRim: PALETTE.gold,
  /** The small "ad can pay" mark under the price. */
  adMark: { size: 40, dimAlpha: 0.5, offsetY: 36 },
  lockSize: 56,
  /** Space between the stairs and the buttons, and between the two buttons. */
  buttonsGap: 36,
  buttonGap: 20,
  adFont: 46,
  playFont: 52,
  shortFont: 44,
  /** The caption "No more ad starts today" under the price. */
  noteFont: 34,
  disabledAlpha: 0.6,
} as const;

/**
 * The weather on the street behind the glass of the Showcase zone (layers 20-40, docs/06, section 5, «Погода»):
 * the rain, snow and leaves fall in front of the houses and behind the panes, the cloud bank of the Roof hangs
 * over the houses smaller and paler, and in snow the house roofs wear white caps. It is further away than
 * the weather of the Roof, so everything here is more muted.
 */

import { BALANCE } from './balance';
import { LOGICAL_SIZE } from './screen';
import type { WeatherId } from './weather';
import type { EffectLevel } from './effect-levels';
import { GLASS_WEATHER } from './window-look';
import { WEATHER_LOOK } from './weather-look';

/** The kinds of falling pictures the street shows. */
export type StreetFallKind = 'rain' | 'storm' | 'snow' | 'leaves';

/** A share of the Roof alpha and size of the falling pictures. */
interface StreetFallLook {
  alpha: number;
  scale: number;
}

/** What the street may show on a level: the level's limit of pictures less the drops or flakes on the glass (they stay on lite, go on minimal). */
function streetRoom(kind: StreetFallKind, level: EffectLevel): number {
  const glass = level === 'minimal' ? 0 : (GLASS_WEATHER[kind]?.showcase ?? 0);
  return Math.max(WEATHER_LOOK.particleCount[level] - glass, 0);
}

const poolOf = (kind: StreetFallKind): number => streetRoom(kind, 'full');

/** What a street pool of falling pictures needs (the game's `FallView` takes it as it is). */
export interface StreetFallView extends StreetFallLook {
  count: number;
  shown: Record<EffectLevel, number>;
  outside?: { share: number; stripShare: number };
  slantShare?: number;
  sides?: { bias: number; share: number };
  tint?: number;
}

export const STREET_WEATHER = {
  /**
   * Falling pictures in the pool: what the glass leaves of the limit of the full level (`WEATHER_LOOK.particleCount`),
   * so the street shows as many as the limit allows (session 5g: the weather must read at first glance). The lower
   * levels fill their own limit the same way (`streetShown`), minimal none.
   */
  count: {
    rain: poolOf('rain'),
    storm: poolOf('storm'),
    snow: poolOf('snow'),
    leaves: poolOf('leaves'),
  } satisfies Record<StreetFallKind, number>,
  /**
   * The rain starts mostly outside the tower (it hides the middle): this share of the drops in the two strips beside
   * it. The lean of the fall smears it, so it is more than the strips' own share (`stripShare`). Raised from 0.55 when
   * the rain began to fall over the whole screen height (a part of it now passes behind the awning and the HUD).
   */
  outsideShare: 0.6,
  /** The flakes of the street are tinted this cool tone: white on the pale street they all but vanished. */
  snowTint: 0xa9bbe6,
  /**
   * The heavy sky between the houses of the street (the Showcase's own sky, darker than the window's, so the
   * cloud tone shows through the gaps): top and bottom colour of its gradient.
   */
  sky: {
    rain: { top: 0x65738a, bottom: 0x97a6ba },
    storm: { top: 0x3e475c, bottom: 0x6c778d },
    snow: { top: 0xa4b0cf, bottom: 0xcbd3e8 },
  } as Partial<Record<WeatherId, { top: number; bottom: number }>>,
  /** The snow starts mostly in the strips beside the tower (the lanes there; the middle is behind the tower). */
  snowSides: { bias: 0.9, share: 0.17 },
  /** The rain on the street leans this share of the Roof's lean. */
  slantShare: 0.5,
  /** The falling pictures are this share of their Roof alpha and size: they are out on the street. */
  alpha: 0.92,
  scale: 0.98,
  /**
   * A kind whose pictures get lost at that share keeps more of its Roof look. White flakes on the pale street
   * of a tall screen all but vanished at 0.6 / 0.85 (their count cannot grow: the lite level is full with the
   * flakes on the glass), so snow is only a little muted.
   */
  own: { snow: { alpha: 0.97, scale: 0.99 } } as Partial<Record<StreetFallKind, StreetFallLook>>,
  /** The cloud bank of the Roof over the houses: smaller (the Roof shows it at 1.27) and paler; it still spans the screen and its drift. */
  bank: {
    scaleX: 1.17,
    scaleY: 1.17,
    alpha: 0.75,
    driftPx: 14,
    /** The storm flashes light the clouds as brightly as on the Roof; no bolt comes down to the street. */
    flashShare: 1,
    bolt: false,
  },
  /**
   * With every flash a soft light falls on the street behind the glass (under the panes, the shop front and the
   * awning, behind the tower), so the flash reads even where the HUD and the awning cover the clouds. One round
   * patch, strongest in the middle and fading to nothing at its edge, centred under the lit part of the cloud;
   * drawn additively with the flash, it follows the flash's rise and fall. `picturePx` is the side of the baked
   * picture, `widthPx` x `heightPx` the size it is shown at, `centreY` its centre (logical px from the top).
   */
  glow: {
    color: 0xfff2d2,
    alpha: 0.46,
    picturePx: 256,
    widthPx: 1400,
    heightPx: 1300,
    centreY: 420,
  },
  /** White caps on the roofs of the houses in snow, baked into the street picture (px of the 512 px tile). */
  cap: {
    snow: 0xfbfcff,
    /** The cold shade under the snow: it outlines the cap on the pale houses. */
    shade: 0xa9b3d2,
    alpha: 1,
    /** How far the cap reaches past the sides of the roof, its height, and the bumps along its lower edge. */
    overhang: 9,
    height: 30,
    shadeHeight: 8,
    drips: [0.16, 0.38, 0.6, 0.84] as readonly number[],
    dripRadius: 8,
    /** The same snow lies on the top of the awnings (px of the tile): the heap's height and the bumps along its top. */
    awningHeight: 26,
    awningBumps: [0.12, 0.34, 0.58, 0.8] as readonly number[],
    awningBumpRadius: 14,
  },
} as const;

/** How many pictures of a kind fall on the street, and the share of their Roof alpha and size they show at. */
export function streetFallView(kind: StreetFallKind): StreetFallView {
  const own = STREET_WEATHER.own[kind];
  return {
    count: STREET_WEATHER.count[kind],
    outside:
      kind === 'rain' || kind === 'storm'
        ? {
            share: STREET_WEATHER.outsideShare,
            stripShare: 1 - BALANCE.tray.width / LOGICAL_SIZE.width,
          }
        : undefined,
    sides: kind === 'snow' ? STREET_WEATHER.snowSides : undefined,
    tint: kind === 'snow' ? STREET_WEATHER.snowTint : undefined,
    slantShare: kind === 'rain' || kind === 'storm' ? STREET_WEATHER.slantShare : undefined,
    shown: {
      full: streetRoom(kind, 'full'),
      lite: streetRoom(kind, 'lite'),
      minimal: streetRoom(kind, 'minimal'),
    },
    alpha: own?.alpha ?? STREET_WEATHER.alpha,
    scale: own?.scale ?? STREET_WEATHER.scale,
  };
}

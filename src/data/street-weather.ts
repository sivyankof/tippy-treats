/**
 * The weather on the street behind the glass of the Showcase zone (layers 20-40, docs/06, section 5, «Погода»):
 * the rain, snow and leaves fall in front of the houses and behind the panes, the cloud bank of the Roof hangs
 * over the houses smaller and paler, and in snow the house roofs wear white caps. It is further away than
 * the weather of the Roof, so everything here is more muted.
 */
export const STREET_WEATHER = {
  /**
   * Falling pictures on the full level (lite shows half, minimal none). With the drops and flakes on the
   * glass (`GLASS_LOOK`: 7 / 10 / 9 / 3) the zone stays within `WEATHER_LOOK.particleCount` on every level.
   */
  count: { rain: 24, storm: 20, snow: 22, leaves: 18 },
  /** The falling pictures are this share of their Roof alpha and size: they are out on the street. */
  alpha: 0.6,
  scale: 0.85,
  /** The cloud bank of the Roof over the houses: smaller (the Roof shows it at 1.27) and paler; it still spans the screen and its drift. */
  bank: {
    scaleX: 1.1,
    scaleY: 1.1,
    alpha: 0.75,
    driftPx: 20,
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
    alpha: 0.34,
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
    overhang: 5,
    height: 18,
    shadeHeight: 5,
    drips: [0.2, 0.55, 0.82] as readonly number[],
    dripRadius: 5,
  },
} as const;

export type StreetFallKind = keyof typeof STREET_WEATHER.count;

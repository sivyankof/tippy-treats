/** Colours from docs/06-art-animation-audio.md, section 1. */
export const PALETTE = {
  accent: 0xff5c8a,
  accentSecondary: 0x7c5cff,
  gold: 0xffc93c,
  berry: 0xe8334a,
  success: 0x3ddc97,
  danger: 0xff7a45,
  textDark: 0x3b2a4a,
  textLight: 0xffffff,
  panel: 0xfff6ec,
  panelShadow: 0xe9d5c3,
} as const;

/** Sponge and glaze colours of a layer; the plain pairs are in `data/plain-layers.ts`. */
export interface LayerColors {
  cake: number;
  glaze: number;
}

/** Kitchen zone backdrop, back to front. */
export const KITCHEN_COLORS = {
  skyTop: 0xffe3c4,
  skyBottom: 0xffc7a1,
  wall: 0xfbd3b0,
  tiles: 0xf6c09a,
  shelf: 0xc98d62,
  counter: 0xb57a52,
  counterTop: 0xe8d6c4,
  tray: 0xd8dde6,
  trayShadow: 0x9aa3b2,
} as const;

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

export interface LayerColors {
  cake: number;
  glaze: number;
}

/** Plain layers take these "cake + glaze" pairs in turn. */
export const LAYER_COLORS: readonly LayerColors[] = [
  { cake: 0xf4c58f, glaze: 0xffb3c7 },
  { cake: 0xe8a873, glaze: 0xfff0d6 },
  { cake: 0xf7d9a8, glaze: 0xb9e4ff },
  { cake: 0xd99a6c, glaze: 0xcdb8ff },
  { cake: 0xf2c48d, glaze: 0xb6f0d2 },
  { cake: 0xe9b380, glaze: 0xffe08a },
];

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

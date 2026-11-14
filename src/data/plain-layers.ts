/**
 * Look of the plain layers (docs/06, section 3, "Простые слои"): kinds of sponge, the
 * "sponge + glaze" pairs, the wavy glaze, the pores, the gloss and the decorations on top.
 * Which pair and which decoration a layer gets comes from the cosmetic stream of the run seed,
 * so the daily tower looks the same for everyone.
 */

export type SpongeKind = 'light' | 'chocolate' | 'caramel';

export type DecorKind = 'sprinkles' | 'berries' | 'flowers' | 'nuts' | 'cream';

/** Every decoration kind; the position in this list is part of the texture key of a layer. */
export const DECOR_KINDS: readonly DecorKind[] = [
  'sprinkles',
  'berries',
  'flowers',
  'nuts',
  'cream',
];

export interface SpongeLook {
  /** Fill of the sponge. */
  cake: number;
  /** The pores and the soft band at the bottom. */
  pore: number;
  /** Warm outline in the tone of the sponge. */
  outline: number;
}

export const SPONGES: Readonly<Record<SpongeKind, SpongeLook>> = {
  light: { cake: 0xf6c98c, pore: 0xd6914c, outline: 0xa8622e },
  // Milk chocolate, clearly lighter than the brownie creature.
  chocolate: { cake: 0xb57a52, pore: 0x7c4528, outline: 0x6a3a20 },
  caramel: { cake: 0xdc9655, pore: 0xa65a22, outline: 0x84451a },
};

export interface PlainPair {
  sponge: SpongeKind;
  glaze: number;
  /** Decorations that suit this pair; one of them is picked when the layer is decorated. */
  decor: readonly DecorKind[];
}

/** The "sponge + glaze" pairs of the plain layers. Neighbouring layers never share a pair. */
export const PLAIN_PAIRS: readonly PlainPair[] = [
  { sponge: 'light', glaze: 0xffaecb, decor: ['sprinkles', 'berries', 'cream'] },
  { sponge: 'light', glaze: 0xfff4e4, decor: ['berries', 'cream', 'sprinkles'] },
  { sponge: 'light', glaze: 0xb8ecd2, decor: ['flowers', 'sprinkles'] },
  { sponge: 'light', glaze: 0xcdb6ff, decor: ['berries', 'flowers', 'cream'] },
  { sponge: 'light', glaze: 0xb7e1ff, decor: ['sprinkles', 'flowers'] },
  { sponge: 'light', glaze: 0x7a4630, decor: ['nuts', 'sprinkles', 'cream'] },
  { sponge: 'chocolate', glaze: 0xfff4e4, decor: ['berries', 'nuts', 'sprinkles'] },
  { sponge: 'chocolate', glaze: 0xffbdd3, decor: ['sprinkles', 'cream', 'berries'] },
  { sponge: 'caramel', glaze: 0xfff0c2, decor: ['nuts', 'cream'] },
  { sponge: 'caramel', glaze: 0xffd36e, decor: ['nuts', 'flowers', 'sprinkles'] },
];

export const PLAIN_LAYER = {
  /** Name of the stream forked from the run seed (`new Rng(seed).fork(cosmeticStream)`). */
  cosmeticStream: 'cosmetic',
  /** Share of the plain layers that carry decorations. */
  decorShare: 0.5,

  /** Glaze over the top with a wavy lower edge of round tongues. */
  glaze: {
    /** Depth of the glaze between the tongues, as a share of the layer height. */
    crestShare: 0.25,
    /** Longest tongue below the crest, as a share of the layer height. */
    tongueShare: 0.19,
    /** Width a tongue aims for; the span is cut into whole tongues of about this width. */
    tongueWidth: 118,
    /** Tongues get shorter by up to this share, each by its own amount. */
    tongueVariation: 0.4,
    /** A tongue in front of the face is this much shorter, so it stays out of the eyes. */
    faceShorten: 0.45,
    /** Shape exponent: below 1 the tongues are round at the bottom and meet in narrow peaks. */
    roundness: 0.6,
    /** Points per tongue of the drawn edge. */
    samplesPerTongue: 14,
    /** Thickness of the darker line under the wavy edge. */
    outlinePx: 4.5,
    /** How much darker that line is than the glaze. */
    outlineShade: -0.22,
    /** Top-to-bottom gradient: how much lighter the top is, and the number of bands. */
    lift: 0.08,
    bands: 4,
  },

  /** Highlight on the glaze along the top, from the left. */
  gloss: {
    inset: 22,
    y: 6,
    height: 9,
    /** Share of the layer width the long streak takes, and its longest length. */
    lengthShare: 0.42,
    maxLength: 260,
    /** A short dash after the streak. */
    gap: 10,
    dash: 14,
    alpha: 0.6,
  },

  /** Body of the sponge: soft darker band at the bottom and a lighter top. */
  body: {
    /** Height of the bottom band as a share of the inner height, its darkest mix and the steps. */
    bandShare: 0.3,
    bandMix: 0.32,
    bandSteps: 4,
    lift: 0.1,
    bands: 4,
  },

  /** Pores of the sponge: small dots of three sizes, none in front of the face. */
  pores: {
    /** One pore per this many square pixels of sponge. */
    areaPerPore: 520,
    radii: [2.2, 3.2, 4.4],
    alpha: 0.42,
    /** Pores keep this far from the outline. */
    inset: 6,
    /** Pores repeat every this many pixels, counted from the uncut edge. */
    tileWidth: 180,
  },

  /** The bitten edge: lighter sponge under the cut glaze, with pores. */
  cut: {
    width: 18,
    lift: 0.2,
    poreCount: 6,
  },

  /**
   * Decorations in the glaze band, on both sides of the face: placed from the outer (uncut)
   * edges inwards at `pitch`, so the ones on the intact side stay put after a bite.
   */
  decor: {
    /** Gap between the decorations and the face (beyond its half width). */
    faceMargin: 18,
    /** First decoration starts this far from the edge of the glaze. */
    edgeInset: 10,
    /** Highest a decoration may reach above the top edge (the picture has room for it). */
    maxRise: 14,
    sprinkles: {
      pitch: 26,
      length: 19,
      width: 7,
      colors: [0xff6f91, 0x7cc6ff, 0xffd35c, 0x8ee39b, 0xffffff, 0xb08cff],
    },
    berries: {
      pitch: 46,
      radius: 11.5,
      strawberry: 0xff4d5e,
      seed: 0xffe9a8,
      leaf: 0x55b85a,
      blueberry: 0x3d4fa8,
      bloom: 0x8fa2e6,
    },
    flowers: {
      pitch: 58,
      petal: 7,
      spread: 8,
      petals: 5,
      color: 0xffffff,
      center: 0xffc93c,
      dot: 0xfff2f6,
    },
    nuts: {
      pitch: 34,
      width: 16,
      height: 11,
      color: 0xe2b170,
      dark: 0xa7713a,
    },
    cream: {
      pitch: 56,
      radius: 11,
      color: 0xfffaf2,
      shadow: 0xe7d6c3,
    },
    /** Bits of the decorations that fly off a bitten edge (none in "Fewer effects"). */
    bits: {
      count: [3, 5] as const,
    },
  },
} as const;

/**
 * Look of the plain layers (docs/06, section 3, "Простые слои"): kinds of sponge, the
 * "sponge + glaze" pairs, the wavy glaze, the pores, the gloss and the decorations on top.
 * Which pair and which decoration a layer gets comes from the cosmetic stream of the run seed,
 * so the daily tower looks the same for everyone.
 */

export type SpongeKind = 'light' | 'chocolate' | 'caramel' | 'marble' | 'waffle';

/** Patterns of the glaze; the position in `PATTERN_KINDS` is part of the look code of a layer. */
export type PatternKind = 'zigzag' | 'lattice' | 'waves' | 'dots';

export const PATTERN_KINDS: readonly PatternKind[] = ['zigzag', 'lattice', 'waves', 'dots'];

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
  /** Drawn pattern of the sponge instead of pores (none for the plain kinds). */
  material?: 'marble' | 'waffle';
}

export const SPONGES: Readonly<Record<SpongeKind, SpongeLook>> = {
  light: { cake: 0xf6c98c, pore: 0xd6914c, outline: 0xa8622e },
  // Milk chocolate, clearly lighter than the brownie creature.
  chocolate: { cake: 0xb57a52, pore: 0x7c4528, outline: 0x6a3a20 },
  caramel: { cake: 0xdc9655, pore: 0xa65a22, outline: 0x84451a },
  // Light sponge with swirls, and a golden waffle: both have shadow tones, but no pores.
  marble: { cake: 0xf8dcae, pore: 0xd6a066, outline: 0xa8742f, material: 'marble' },
  waffle: { cake: 0xf2c76e, pore: 0xc98f36, outline: 0xa0702a, material: 'waffle' },
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
  { sponge: 'marble', glaze: 0xffe08a, decor: ['berries', 'cream', 'sprinkles'] },
  { sponge: 'marble', glaze: 0x8fd9d0, decor: ['flowers', 'sprinkles', 'cream'] },
  { sponge: 'waffle', glaze: 0xffaecb, decor: ['berries', 'cream', 'sprinkles'] },
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
    /** Thin light rim along the top edge: its thickness and how much lighter it is. */
    rimPx: 3,
    rimLift: 0.16,
    /** Darker second tone along the lower wavy edge, above the dark line: thickness and shade. */
    bandPx: 7,
    bandShade: -0.1,
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

  /** Body of the sponge in flat steps: a light band under the glaze, the main colour, two shadows. */
  body: {
    /** Light band under the glaze edge: height as a share of the inner height, and how light. */
    topShare: 0.16,
    topLift: 0.12,
    /** Shadow steps at the bottom: height as a share of the inner height and mix towards the pore tone. */
    shadows: [
      { share: 0.3, mix: 0.16 },
      { share: 0.14, mix: 0.34 },
    ],
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

  /**
   * Shade a layer lays on the one below it, along the overlap of the two: one flat warm tone at
   * the top of the lower layer, inside its outline.
   */
  overlapShade: {
    color: 0x4a2412,
    alpha: 0.34,
    /** Height of the band below the inner top edge. */
    height: 17,
  },

  /**
   * Patterns on the glaze of the layers without small decorations. They repeat from the uncut
   * edge, stay above the wavy edge and keep clear of the face.
   */
  pattern: {
    /** Share of the layers without decorations that stay plain. */
    plainShare: 1 / 3,
    /** Gap to keep from the wavy edge (and its darker band), the top and the sides, and the face. */
    edgeGap: 4,
    topGap: 8,
    sideGap: 12,
    faceMargin: 18,
    /** Step of the sampled lines. */
    step: 2,
    /** How much lighter the pattern is than the glaze, and the darker tone used on a very light glaze. */
    lift: 0.75,
    darkShade: -0.26,
    /** A glaze lighter than this (0..1) takes the dark tone. */
    lightLuma: 0.9,
    zigzag: { period: 24, amplitude: 4, width: 4 },
    lattice: { pitch: 32, width: 4 },
    waves: { period: 60, amplitude: 4, width: 4.5, rowPitch: 16 },
    dots: { pitch: 40, rowPitch: 26, radius: 7 },
  },

  /** Marble sponge: a few long smooth wavy ribbons across the whole layer, each with its own edge. */
  marble: {
    /**
     * Ribbons: height share of the sponge band they sit at, wave period, amplitude, phase, the
     * width, the fill and the edge (`null`: no edge). Long periods and wide bends keep them smooth.
     */
    ribbons: [
      {
        yShare: 0.26,
        period: 140,
        amplitude: 6,
        phase: 0,
        width: 12,
        color: 0xd69a52,
        edge: 0xa86a2c,
      },
      {
        yShare: 0.5,
        period: 140,
        amplitude: 5,
        phase: 0.7,
        width: 7,
        color: 0xeeb978,
        edge: 0xc88a48,
      },
      {
        yShare: 0.74,
        period: 170,
        amplitude: 3,
        phase: 1.6,
        width: 3.5,
        color: 0xfff6e8,
        edge: null,
      },
    ],
    edgePx: 1.5,
    /** A piece of a ribbon shorter than this (a stub left by the face or the outline) is not drawn. */
    minLength: 70,
    /** On a narrow layer the shortest piece is at most this share of the side stretch left, so shorter ribbons survive. */
    minShare: 0.5,
    /** No piece is drawn shorter than this, so there are no dots, however narrow the stretch. */
    minFloor: 24,
    /** Gap to the face, the outline and the cut. */
    faceMargin: 14,
    inset: 8,
  },

  /** Waffle sponge: a grid of darker lines and a thin cream layer across. */
  waffle: {
    line: 0xc98a30,
    lineWidth: 2.5,
    cell: 22,
    cream: 0xfff1cf,
    creamEdge: 0xe0b878,
    creamYShare: 0.55,
    creamWidth: 7,
    creamEdgePx: 1.5,
    faceMargin: 14,
    inset: 6,
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

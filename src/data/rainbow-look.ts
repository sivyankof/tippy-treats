/** The five thin sponge layers of the rainbow cake, top to bottom; the effects take the same colours. */
export const RAINBOW_BANDS = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7'] as const;

/** The gold of the star on the crown of the Rainbow layer. */
const STAR_GOLD = 0xffc93c;

/**
 * The look of the Rainbow layer (docs/06, section 3, "Радужка"): a rainbow cake cut open, five thin
 * coloured sponge layers with white cream between them and pores, a thin white glaze on top and a
 * gold star on the crown. Pixels of the layer picture.
 */
export const RAINBOW_LOOK = {
  /** The soft wave of every sponge edge: height of a crest, length of one period, step of the drawn polyline. */
  wave: { amplitude: 3, length: 150, step: 8 },
  band: {
    /** Height of a coloured sponge and of the cream strip under it, as shares of the room under the glaze. */
    sponge: 0.15,
    cream: 0.06,
    /** The lower strip of a sponge in its shadow tone, as a share of the sponge height. */
    shadowShare: 0.35,
    /** Pores: how many fit a full-width layer, radius, and how far they keep off the sides. */
    pores: { perFullWidth: 16, radius: 1.8, inset: 22, faceGap: 10, alpha: 0.35 },
    /** The short white stroke on the glaze: thickness, length, opacity, how far it sits from the left side. */
    gloss: { thick: 3, length: 40, alpha: 0.85, inset: 30 },
  },
  star: {
    color: STAR_GOLD,
    /** Outer radius, how far the centre sits above the layer top, outline thickness and the notch depth. */
    radius: 22,
    lift: 8,
    outline: 3.5,
    notch: 0.55,
    /** The white gloss stroke and dot on the star: centre as shares of the radius, length, thickness, tilt (radians), dot gap and radius. */
    gloss: { x: -0.35, y: -0.35, length: 0.5, thick: 0.16, tilt: -0.9, dotGap: 3, dotRadius: 1.8 },
  },
} as const;

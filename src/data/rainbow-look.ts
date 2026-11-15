import { parseHex } from '../util/color';
import { ABILITY_ANIM } from './ability-anim';

/** The five thin sponge layers of the rainbow cake, top to bottom; the effects take the same colours. */
export const RAINBOW_BANDS = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7'] as const;
/** The same colours as numbers. */
export const RAINBOW_BAND_COLORS: readonly number[] = RAINBOW_BANDS.map(parseHex);

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
  /**
   * The rest animation of the layer: every `waveEveryMs` a colour wave runs left to right, each sponge
   * (top to bottom, `staggerMs` apart) swelling up to `bulgePx` and lighter by `brighten` in a window
   * `halfPx` each side of the wave, which crosses the layer in `travelMs`; the star sways `swayDeg`
   * (period `swayMs`) and every `sparkleEveryMs` flashes for `sparkleMs` (it swells by `sparkleScale`
   * and a white four-point sparkle of `sparkleSize` (share of the star radius) shows at its upper right).
   */
  idle: {
    waveEveryMs: 4600,
    staggerMs: 150,
    travelMs: 900,
    halfPx: 56,
    bulgePx: 3,
    brighten: 0.4,
    sliceStep: 6,
    swayDeg: 7,
    swayMs: 1700,
    sparkleEveryMs: 3300,
    sparkleMs: 420,
    sparkleScale: 0.25,
    sparkleSize: 0.7,
    sparkleOffset: { x: 0.55, y: -0.55 },
    sparkleNotch: 0.25,
    /**
     * The rare joke (a seeded cosmetic stream, never more often than every `minGapMs`..`maxGapMs`;
     * the first one after `firstMinMs`..`firstMaxMs`): a small rainbow arch pops out of the star,
     * `spanPx` wide, rising `risePx`, growing for `growMs`, held `holdMs`, fading for `fadeMs`; the
     * Rainbow squints shyly for `squintMs`.
     */
    joke: {
      seed: 7,
      firstMinMs: 12000,
      firstMaxMs: 25000,
      minGapMs: 40000,
      maxGapMs: 60000,
      spanPx: 74,
      risePx: 44,
      bandPx: 3.2,
      outlinePx: 2,
      steps: 14,
      growMs: 450,
      holdMs: 800,
      fadeMs: 300,
      squintMs: 1300,
      /** How long the layers above and below look at the star. */
      glanceMs: 1300,
      /** Gloss of the band: the same as on the arc of the Rainbow ability. */
      glossShare: ABILITY_ANIM.rainbow.arc.glossShare,
      glossAlpha: ABILITY_ANIM.rainbow.arc.glossAlpha,
      growEase: 'Back.easeOut',
      /** Where the arch starts and ends, as shares of the star radius below (+) / above (-) its centre. */
      startY: -0.3,
      endY: 1,
      /** Chance that the arch goes to the left. */
      leftChance: 0.5,
    },
  },
} as const;

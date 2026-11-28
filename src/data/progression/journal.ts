/**
 * The baker's journal (docs/04-meta-retention.md, section 11): counters of all time with a
 * comparison that changes by tiers. A tier starts at its threshold; the first threshold is 0.
 * Where a counter is shared with the achievements (flies, perfect drops, runs, layers), tiers
 * 1..3 are the thresholds of the achievement tiers I..III. The journal pays nothing.
 */
export const JOURNAL_ROW_IDS = ['layers', 'height', 'glaze', 'perfects', 'runs'] as const;
export type JournalRowId = (typeof JOURNAL_ROW_IDS)[number];

/** One tier of a comparison: where it starts and why that number (one line, for honest sizes). */
export interface JournalTier {
  from: number;
  basis: string;
}

export const JOURNAL = {
  /** Height of one layer of the game in metres: a sponge cake layer is 4-6 cm high. */
  layerHeightM: 0.05,
  /** Glaze on one layer in litres: the top of a 20 cm sponge takes about 100 ml of glaze. */
  glazePerLayerL: 0.1,

  /** The fly bar on top and its window: a rank per tier, tiers 1..5 are the dishes. */
  flies: [
    { from: 0, basis: 'start' },
    { from: 50, basis: 'achievement "Fly Swatter" I; a glass' },
    { from: 500, basis: 'achievement "Fly Swatter" II; a jar' },
    { from: 1000, basis: 'achievement "Fly Swatter" III; a pot' },
    { from: 2500, basis: 'a bucket, beyond the achievements' },
    { from: 5000, basis: 'a bathtub, beyond the achievements' },
  ],

  rows: {
    /** Layers of all runs (`stats.totalLayers`); one layer is about one serving. */
    layers: [
      { from: 0, basis: 'a family tea party' },
      {
        from: 1000,
        basis: 'achievement "Feed the School" I; a big school is about 1 000 children',
      },
      { from: 10000, basis: 'achievement "Feed the School" II; a village of about 10 000 people' },
      { from: 50000, basis: 'achievement "Feed the School" III; a stadium of about 50 000 seats' },
      { from: 100000, basis: 'a city of about 100 000 people' },
    ],
    /** All towers stacked, metres (`stats.totalLayers` x `layerHeightM`). */
    height: [
      { from: 0, basis: 'start' },
      { from: 5.5, basis: 'a tall giraffe is about 5.5 m' },
      { from: 27, basis: 'a nine-storey block is about 27 m (9 floors of 3 m)' },
      { from: 330, basis: 'the Eiffel Tower is 330 m' },
      { from: 2000, basis: 'low clouds hang at about 2 km' },
      { from: 8849, basis: 'Everest is 8 849 m' },
      { from: 420000, basis: 'the space station flies about 420 km up' },
    ],
    /** Glaze of all layers, litres (`stats.totalLayers` x `glazePerLayerL`). */
    glaze: [
      { from: 0, basis: 'start' },
      { from: 1.7, basis: 'a kettle holds about 1.7 l' },
      { from: 10, basis: 'a bucket holds about 10 l' },
      { from: 150, basis: 'a bathtub holds about 150 l' },
      { from: 1000, basis: 'a paddling pool holds about 1 000 l' },
      { from: 10000, basis: 'a milk tanker truck holds about 10 000 l' },
    ],
    /** Perfect drops (`stats.perfects`). */
    perfects: [
      { from: 0, basis: 'start' },
      { from: 500, basis: 'achievement "Steady Hand" I' },
      { from: 5000, basis: 'achievement "Steady Hand" II' },
      { from: 25000, basis: 'achievement "Steady Hand" III' },
      { from: 100000, basis: 'beyond the achievements' },
    ],
    /** Toppled towers: every run ends with one (`stats.runs`, daily and quit runs included). */
    runs: [
      { from: 0, basis: 'start' },
      { from: 10, basis: 'achievement "Tower Builder" I' },
      { from: 100, basis: 'achievement "Tower Builder" II' },
      { from: 500, basis: 'achievement "Tower Builder" III' },
      { from: 2000, basis: 'beyond the achievements' },
    ],
  } satisfies Record<JournalRowId, readonly JournalTier[]>,

  /** How a length or a volume is written: one decimal below these, whole above; km from `kmFromM`. */
  decimalsBelow: 10,
  kmFromM: 1000,
} as const;

/**
 * Plain layers licking the glaze (docs/06, section 3, "Жизнь башни"). A rare idle event: a layer
 * glances at a glaze drip near it, sticks out its tongue, laps the drip shorter and squints happily.
 * Distances are pixels in the coordinates of the face (scale 1), times are milliseconds.
 */
export const LICK = {
  /** At most one lick for the whole tower per this time, counted from the start of the last one. */
  intervalMs: [6000, 10000] as readonly [number, number],
  /** The first lick of a run comes after this time. */
  firstDelayMs: [3000, 6000] as readonly [number, number],
  /** When nothing can be licked right now the next look comes after this time. */
  retryMs: 1200,
  /** The tongue reaches targets at this distance from the mouth, no nearer and no farther. */
  reachPx: [28, 128] as readonly [number, number],
  /** A drip must have grown at least this long to be worth licking. */
  minDripPx: 8,
  /** One lick takes off this much of a drip (all of it, if the drip is shorter). */
  shortenPx: 18,
  /** A drip of the layer above counts as running onto the layer when its tip is this far inside it. */
  aboveOverlapPx: 4,
  /** A layer is on screen for a lick when it is at least this far from the screen edge. */
  screenMarginPx: 40,
  /** A drop that fell this recently can still be licked (ms). */
  dropFreshMs: 140,
  /** A drop is eaten with a shorter glance, it falls fast. */
  dropGlanceMs: 60,
  /** The glance up at the target before the tongue comes out. */
  glanceMs: 380,
  reachMs: 200,
  lapMs: 380,
  retractMs: 170,
  /** The happy squint after the lick. */
  happyMs: 800,
  /** The tongue swings by this angle (degrees) while it laps, `lapWaves` times. */
  lapWobbleDeg: 7,
  lapWaves: 2.5,
  /** The tongue never gets shorter than this (picture pixels) once it is out. */
  tongueMinPx: 14,
  /** Where the tongue comes out of the mouth: below the centre of the mouth picture. */
  tongueOriginDy: 4,
  /** Height of the tongue stem picture; the stem is stretched by scale to the wanted length. */
  tongueTextureHeight: 40,
  /** Height of the round tip picture, which sits at the end of the stem and is never stretched. */
  tongueTipPx: 10,
  /**
   * The tongue keeps this far beyond the eye radius from the centre of either eye on its way;
   * negative lets it graze the lower rim of an eye, which covers it.
   */
  eyeClearPx: -8,
} as const;
